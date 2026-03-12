import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityAction,
  ActorRole,
  Prisma,
  RequestStatus,
  RequestType,
  Urgency,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBuildingRequestDto } from './dto/create-building-request.dto';
import { CreateVehicleRequestDto } from './dto/create-vehicle-request.dto';
import { CreateMessengerRequestDto } from './dto/create-messenger-request.dto';
import { CreateDocumentRequestDto } from './dto/create-document-request.dto';
import { MyRequestsQueryDto } from './dto/my-requests.query.dto';
import {
  assertBuildingOtherRule,
  assertBuildingRefsExist,
} from './rules/building.rules';
import {
  assertVehicleOtherRule,
  assertVehicleRefsExist,
} from './rules/vehicle.rules';
import { assertMessengerDeliveryRule } from './rules/messenger.rules';
import { assertDocumentCreateRule } from './rules/document.rules';
import {
  assertEmployeeCancelableStatus,
  normalizeCancelReason,
} from './rules/cancel-request.rules';
import {
  isDuplicateBuildingRequest,
  isDuplicateDocumentRequest,
  isDuplicateMessengerRequest,
  isDuplicateVehicleRequest,
  normalizeSiteName,
  type RequestDedupeCandidate,
} from './rules/request-dedupe.rules';
import { MessengerService } from '../messenger/messenger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestNoService } from './request-no.service';

type Tx = Prisma.TransactionClient;
type DetailCreator = (tx: Tx, requestId: string) => Promise<void>;
type DedupeMatcher = (recentRequests: RequestDedupeCandidate[]) => boolean;

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messengerService: MessengerService,
    private readonly notificationsService: NotificationsService,
    private readonly requestNoService: RequestNoService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Core transaction creator:
   * - validate common refs (department)
   * - create Request
   * - call feature detailCreator (create detail table)
   * - create CREATE log
   * - update latestActivityAt
   * - return minimal response
   */
  private async createRequestCore(params: {
    type: RequestType;
    urgency: Urgency;
    employeeName: string;
    departmentId: string;
    phone: string;
    detailCreator: DetailCreator;
    dedupeMatcher: DedupeMatcher;
  }) {
    const {
      type,
      urgency,
      employeeName,
      departmentId,
      phone,
      detailCreator,
      dedupeMatcher,
    } = params;

    return this.prisma.$transaction(async (tx) => {
      if (this.requestCreateUseDbLock()) {
        await this.acquireRequestCreateLock(tx, type, phone);
      }

      // common FK validate: department
      const dept = await tx.department.findUnique({
        where: { id: departmentId },
        select: { id: true },
      });

      if (!dept) {
        throw new BadRequestException({
          code: 'INVALID_DEPARTMENT_ID',
          message: 'Invalid departmentId',
        });
      }

      const dedupeWindowSeconds = this.requestDedupeWindowSeconds();

      if (dedupeWindowSeconds > 0) {
        const createdAfter = new Date(Date.now() - dedupeWindowSeconds * 1000);

        const recentRequests = await tx.request.findMany({
          where: {
            type,
            phone,
            createdAt: { gte: createdAfter },
            status: {
              in: [
                RequestStatus.NEW,
                RequestStatus.APPROVED,
                RequestStatus.IN_PROGRESS,
                RequestStatus.IN_TRANSIT,
                RequestStatus.DONE,
              ],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            buildingRepairDetail: true,
            vehicleRepairDetail: true,
            messengerBookingDetail: {
              include: {
                senderAddress: true,
                receiverAddress: true,
              },
            },
            documentRequestDetail: {
              include: {
                deliveryAddress: true,
              },
            },
          },
        });

        if (dedupeMatcher(recentRequests)) {
          throw new BadRequestException({
            code: 'DUPLICATE_REQUEST',
            message:
              'Duplicate request detected. Please wait a moment before submitting again.',
          });
        }
      }

      // 1) create Request
      const request = await tx.request.create({
        data: {
          requestNo: await this.requestNoService.next(tx),
          type,
          status: RequestStatus.NEW,
          urgency,
          employeeName,
          departmentId,
          phone,
        },
      });

      // 2) feature-specific detail
      await detailCreator(tx, request.id);

      // 3) log CREATE (common)
      await tx.requestActivityLog.create({
        data: {
          requestId: request.id,
          action: ActivityAction.CREATE,
          actorRole: ActorRole.EMPLOYEE,
        },
      });

      if (type === RequestType.MESSENGER) {
        await this.notificationsService.notifyAdminMessengerBooked(
          {
            requestId: request.id,
            requestNo: request.requestNo,
            employeeName: request.employeeName,
          },
          tx,
        );
      }

      // 4) latestActivityAt (common)
      await tx.request.update({
        where: { id: request.id },
        data: { latestActivityAt: new Date() },
        select: { id: true },
      });

      return {
        id: request.id,
        requestNo: request.requestNo,
        status: request.status,
      };
    });
  }

  // -----------------------------
  // Feature: BUILDING
  // -----------------------------
  async createBuilding(dto: CreateBuildingRequestDto) {
    // feature rule: other requires text
    assertBuildingOtherRule(dto);

    return this.createRequestCore({
      type: RequestType.BUILDING,
      urgency: dto.urgency,
      employeeName: dto.employeeName,
      departmentId: dto.departmentId,
      phone: dto.phone,
      dedupeMatcher: (recentRequests) =>
        isDuplicateBuildingRequest(dto, recentRequests),
      detailCreator: async (tx, requestId) => {
        // feature FK validate: problemCategory
        await assertBuildingRefsExist(tx, dto);

        await tx.buildingRepairDetail.create({
          data: {
            requestId,
            building: dto.building,
            floor: dto.floor,
            locationDetail: dto.locationDetail,

            problemCategoryId: dto.problemCategoryId,
            problemCategoryOther: dto.problemCategoryOther ?? null,

            description: dto.description,
            additionalDetails: dto.additionalDetails ?? null,
          },
        });
      },
    });
  }

  // -----------------------------
  // Feature: VEHICLE
  // -----------------------------
  async createVehicle(dto: CreateVehicleRequestDto) {
    assertVehicleOtherRule(dto);

    return this.createRequestCore({
      type: RequestType.VEHICLE,
      urgency: dto.urgency,
      employeeName: dto.employeeName,
      departmentId: dto.departmentId,
      phone: dto.phone,
      dedupeMatcher: (recentRequests) =>
        isDuplicateVehicleRequest(dto, recentRequests),
      detailCreator: async (tx, requestId) => {
        await assertVehicleRefsExist(tx, dto);

        await tx.vehicleRepairDetail.create({
          data: {
            requestId,
            vehiclePlate: dto.vehiclePlate,
            issueCategoryId: dto.issueCategoryId,
            issueCategoryOther: dto.issueCategoryOther ?? null,
            symptom: dto.symptom,
            additionalDetails: dto.additionalDetails ?? null,
          },
        });
      },
    });
  }

  // -----------------------------
  // Feature: MESSENGER
  // -----------------------------
  async createMessenger(dto: CreateMessengerRequestDto) {
    assertMessengerDeliveryRule(dto);

    return this.createRequestCore({
      type: RequestType.MESSENGER,
      urgency: dto.urgency,
      employeeName: dto.employeeName,
      departmentId: dto.departmentId,
      phone: dto.phone,
      dedupeMatcher: (recentRequests) =>
        isDuplicateMessengerRequest(dto, recentRequests),

      detailCreator: async (tx, requestId) => {
        const sender = await tx.address.create({
          data: dto.sender,
        });

        const receiver = await tx.address.create({
          data: dto.receiver,
        });

        await tx.messengerBookingDetail.create({
          data: {
            requestId,
            pickupDatetime: new Date(dto.pickupDatetime),

            itemType: dto.itemType,
            itemDescription: dto.itemDescription,

            outsideBkkMetro: dto.outsideBkkMetro,

            deliveryService: dto.deliveryService ?? null,
            deliveryServiceOther: dto.deliveryServiceOther ?? null,

            senderAddressId: sender.id,
            receiverAddressId: receiver.id,
          },
        });
      },
    });
  }

  // -----------------------------
  // Feature: DOCUMENT
  // -----------------------------
  async createDocument(dto: CreateDocumentRequestDto) {
    assertDocumentCreateRule(dto);

    const siteNameNormalized = normalizeSiteName(dto.siteNameRaw);

    return this.createRequestCore({
      type: RequestType.DOCUMENT,
      urgency: dto.urgency,
      employeeName: dto.employeeName,
      departmentId: dto.departmentId,
      phone: dto.phone,
      dedupeMatcher: (recentRequests) =>
        isDuplicateDocumentRequest(dto, recentRequests),
      detailCreator: async (tx, requestId) => {
        // POSTAL: create immutable address snapshot and bind deliveryAddressId
        let deliveryAddressId: string | null = null;

        if (dto.deliveryMethod === 'POSTAL') {
          const addr = await tx.address.create({
            data: {
              name: dto.deliveryAddress!.name,
              phone: dto.deliveryAddress!.phone,
              province: dto.deliveryAddress!.province,
              district: dto.deliveryAddress!.district,
              subdistrict: dto.deliveryAddress!.subdistrict,
              postalCode: dto.deliveryAddress!.postalCode,
              houseNo: dto.deliveryAddress!.houseNo,
              soi: dto.deliveryAddress!.soi ?? null,
              road: dto.deliveryAddress!.road ?? null,
              extra: dto.deliveryAddress!.extra ?? null,
            },
          });
          deliveryAddressId = addr.id;
        }

        await tx.documentRequestDetail.create({
          data: {
            requestId,
            siteNameRaw: dto.siteNameRaw,
            siteNameNormalized,

            documentDescription: dto.documentDescription,
            purpose: dto.purpose,
            neededDate: new Date(dto.neededDate),

            deliveryMethod: dto.deliveryMethod,
            note: dto.note ?? null,

            deliveryAddressId, // POSTAL only
            digitalFileAttachmentId: null, // admin fills before DONE for DIGITAL
            pickupNote: null, // admin fills before DONE for PICKUP
          },
        });
      },
    });
  }

  private async acquireRequestCreateLock(
    tx: Tx,
    type: RequestType,
    phone: string,
  ) {
    const lockKey = this.requestCreateLockKey(type, phone);

    await tx.$queryRaw`
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      )
      SELECT true AS "acquired"
    `;
  }


  private async acquireRequestMutationLock(tx: Tx, requestId: string) {
    const lockKey = `request_mutation:${requestId}`;

    await tx.$queryRaw`
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      )
      SELECT true AS "acquired"
    `;
  }

  private requestCreateLockKey(type: RequestType, phone: string) {
    return `request_create:${type}:${phone.trim()}`;
  }
  private requestDedupeWindowSeconds() {
    return this.config.get<number>('requestDedupeWindowSeconds') ?? 30;
  }

  private requestCreateUseDbLock() {
    return this.config.get<boolean>('requestCreateUseDbLock') ?? true;
  }

  async cancelRequest(id: string, phone: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.acquireRequestMutationLock(tx, id);

      const req = await tx.request.findUnique({
        where: { id },
        select: {
          id: true,
          requestNo: true,
          type: true,
          status: true,
          phone: true,
        },
      });

      if (!req) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Request not found',
        });
      }

      if (req.phone !== phone) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Not your request',
        });
      }

      assertEmployeeCancelableStatus(req.status);

      const normalizedReason = normalizeCancelReason(reason);
      const now = new Date();

      await tx.request.update({
        where: { id },
        data: {
          status: RequestStatus.CANCELED,
          cancelReason: normalizedReason,
          closedAt: now,
          latestActivityAt: now,
        },
      });

      await tx.requestActivityLog.create({
        data: {
          requestId: id,
          action: ActivityAction.CANCEL,
          fromStatus: req.status,
          toStatus: RequestStatus.CANCELED,
          actorRole: ActorRole.EMPLOYEE,
          note: normalizedReason,
        },
      });

      if (req.type === RequestType.MESSENGER) {
        await this.messengerService.revokeMagicLinkForRequest(tx, id);
      }

      await this.notificationsService.notifyAdminRequestCanceled(
        {
          requestId: id,
          requestNo: req.requestNo,
          reason: normalizedReason,
        },
        tx,
      );

      return {
        id,
        status: RequestStatus.CANCELED,
      };
    });
  }
  // -----------------------------
  // Feature: MY REQUESTS
  // -----------------------------
  async getMyRequests(phone: string, q: MyRequestsQueryDto) {
    const where: Prisma.RequestWhereInput = {
      phone,
      ...(q.type ? { type: q.type } : {}),
      ...(q.status ? { status: q.status } : {}),
    };

    const query = q.q?.trim();

    if (query) {
      where.OR = [
        { requestNo: { contains: query, mode: 'insensitive' } },
        { employeeName: { contains: query, mode: 'insensitive' } },
      ];
    }

    const MAX_LIMIT = 100;
    const DEFAULT_LIMIT = 20;
    const DEFAULT_PAGE = 1;

    const limit = Math.min(q.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const page = q.page ?? DEFAULT_PAGE;
    const skip = (page - 1) * limit;

    const sortBy = q.sortBy ?? 'latestActivityAt';
    const sortOrder = q.sortOrder ?? 'desc';

    const [total, items] = await Promise.all([
      this.prisma.request.count({ where }),
      this.prisma.request.findMany({
        where,
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
        select: {
          id: true,
          requestNo: true,
          type: true,
          status: true,
          urgency: true,
          createdAt: true,
          latestActivityAt: true,
          closedAt: true,
        },
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
    };
  }

  // -----------------------------
  // Feature: REQUEST DETAIL
  // -----------------------------
  async getRequestDetail(id: string, phone?: string) {
    const req = await this.prisma.request.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
        activityLogs: {
          orderBy: { createdAt: 'asc' },
          include: { operator: true },
        },

        buildingRepairDetail: { include: { problemCategory: true } },
        vehicleRepairDetail: { include: { issueCategory: true } },
        messengerBookingDetail: {
          include: { senderAddress: true, receiverAddress: true },
        },
        documentRequestDetail: {
          include: { deliveryAddress: true, digitalFileAttachment: true },
        },
      },
    });

    if (!req) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Request not found',
      });
    }

    if (phone && req.phone !== phone) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Not your request',
      });
    }

    return req;
  }
}

