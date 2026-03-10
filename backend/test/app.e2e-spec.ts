import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { ReadinessService } from '../src/health/readiness.service';
import { AdminRequestsService } from '../src/modules/admin-requests/admin-requests.service';
import { AdminAuditService } from '../src/modules/admin-audit/admin-audit.service';
import { AdminAuthService } from '../src/modules/admin-auth/admin-auth.service';
import { AdminSettingsService } from '../src/modules/admin-settings/admin-settings.service';
import { AttachmentsService } from '../src/modules/attachments/attachments.service';
import { AuthOtpService } from '../src/modules/auth-otp/auth-otp.service';
import { MaintenanceService } from '../src/modules/maintenance/maintenance.service';
import { MessengerService } from '../src/modules/messenger/messenger.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { ReferenceService } from '../src/modules/reference/reference.service';
import { RequestsService } from '../src/modules/requests/requests.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('HR Buddy API (e2e)', () => {
  let app: INestApplication;

  const employeeSession = {
    id: 'sess-1',
    phone: '+66811111111',
    email: 'employee@cl.local',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  };

  const prismaServiceMock = {
    $queryRaw: jest.fn(async () => [{ '?column?': 1 }]),
  };

  const authOtpServiceMock = {
    sendOtp: jest.fn(async () => ({
      expiresAt: new Date('2030-01-01T00:05:00.000Z'),
      devOtp: '123456',
    })),
    verifyOtp: jest.fn(async () => ({
      sessionToken: 'emp-valid-token',
      expiresAt: new Date('2030-01-01T00:30:00.000Z'),
    })),
    validateSessionToken: jest.fn(async (token: string) =>
      token === 'emp-valid-token' ? employeeSession : null,
    ),
  };

  const requestsServiceMock = {
    createBuilding: jest.fn(async () => ({
      id: 'req-1',
      requestNo: 'HRB-20260308-REQ1',
      status: 'NEW',
    })),
    createVehicle: jest.fn(async () => ({
      id: 'req-2',
      requestNo: 'HRB-20260308-REQ2',
      status: 'NEW',
    })),
    createMessenger: jest.fn(async () => ({
      id: 'req-3',
      requestNo: 'HRB-20260308-REQ3',
      status: 'NEW',
    })),
    createDocument: jest.fn(async () => ({
      id: 'req-4',
      requestNo: 'HRB-20260308-REQ4',
      status: 'NEW',
    })),
    cancelRequest: jest.fn(async (id: string) => ({
      id,
      status: 'CANCELED',
    })),
    getMyRequests: jest.fn(async (phone: string) => ({
      items: [
        {
          id: 'req-1',
          requestNo: 'HRB-20260308-REQ1',
          phone,
          status: 'NEW',
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
    })),
    getRequestDetail: jest.fn(async (id: string) => ({
      id,
      phone: employeeSession.phone,
      status: 'NEW',
    })),
  };

  const attachmentsServiceMock = {
    issueEmployeeUploadTicket: jest.fn(async () => ({
      uploadToken: 'ticket-1',
      storageKey: 'requests/req-1/file.pdf',
      uploadUrl: 'https://upload.example/file.pdf',
      uploadMethod: 'PUT',
      uploadHeaders: { 'content-type': 'application/pdf' },
      expiresAt: new Date('2030-01-01T00:15:00.000Z'),
    })),
    completeEmployeeUpload: jest.fn(async () => ({
      id: 'att-1',
      requestId: 'req-1',
      fileName: 'file.pdf',
    })),
    getEmployeeDownloadUrl: jest.fn(async () => ({
      attachmentId: 'att-1',
      fileName: 'file.pdf',
      downloadUrl: 'https://download.example/file.pdf',
      expiresAt: new Date('2030-01-01T00:15:00.000Z'),
    })),
    addEmployeeAttachment: jest.fn(async () => ({
      id: 'att-emp-legacy-1',
      requestId: 'req-1',
      fileName: 'legacy-emp.pdf',
    })),
    issueAdminUploadTicket: jest.fn(async () => ({
      uploadToken: 'ticket-admin',
      storageKey: 'requests/req-1/admin.pdf',
      uploadUrl: 'https://upload.example/admin.pdf',
      uploadMethod: 'PUT',
      uploadHeaders: {},
      expiresAt: new Date('2030-01-01T00:15:00.000Z'),
    })),
    completeAdminUpload: jest.fn(async () => ({
      id: 'att-admin-1',
      requestId: 'req-1',
      fileName: 'admin.pdf',
    })),
    getAdminDownloadUrl: jest.fn(async () => ({
      attachmentId: 'att-admin-1',
      fileName: 'admin.pdf',
      downloadUrl: 'https://download.example/admin.pdf',
      expiresAt: new Date('2030-01-01T00:15:00.000Z'),
    })),
    addAdminAttachment: jest.fn(async () => ({
      id: 'att-admin-legacy-1',
      requestId: 'req-1',
      fileName: 'legacy-admin.pdf',
    })),
  };

  const adminRequestsServiceMock = {
    list: jest.fn(async () => ({ items: [], page: 1, limit: 20, total: 0 })),
    summary: jest.fn(async () => ({
      total: 0,
      byStatus: {
        NEW: 0,
        APPROVED: 0,
        IN_PROGRESS: 0,
        IN_TRANSIT: 0,
        DONE: 0,
        REJECTED: 0,
        CANCELED: 0,
      },
      byType: {
        BUILDING: 0,
        VEHICLE: 0,
        MESSENGER: 0,
        DOCUMENT: 0,
      },
      byDay: [],
    })),
    exportCsv: jest.fn(async () => ({
      fileName: 'requests-export.csv',
      rowCount: 1,
      csvContent: 'requestNo,status\nHRB-1,NEW',
    })),
    detail: jest.fn(async (id: string) => ({ id, status: 'NEW' })),
    updateStatus: jest.fn(async (id: string) => ({ id, status: 'DONE' })),
  };

  const adminAuthServiceMock = {
    login: jest.fn(async () => ({
      sessionToken: 'admin-valid-token',
      expiresAt: new Date('2030-01-01T08:00:00.000Z'),
    })),
    verifySessionToken: jest.fn(async (token: string) =>
      token === 'admin-valid-token'
        ? {
            username: process.env.ADMIN_USERNAME ?? 'admin',
            expiresAt: new Date('2030-01-01T08:00:00.000Z'),
          }
        : null,
    ),
    logout: jest.fn(async () => ({ ok: true })),
  };

  const adminAuditServiceMock = {
    list: jest.fn(async () => ({
      items: [
        {
          id: 'log-1',
          requestId: 'req-1',
          requestNo: 'HRB-20260308-REQ1',
          requestType: 'BUILDING',
          requestStatus: 'NEW',
          action: 'CREATE',
          fromStatus: null,
          toStatus: null,
          actorRole: 'EMPLOYEE',
          operatorId: null,
          operatorName: null,
          note: null,
          createdAt: new Date('2030-01-01T00:00:00.000Z'),
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
    })),
    exportCsv: jest.fn(async () => ({
      fileName: 'audit-activity-export.csv',
      rowCount: 1,
      csvContent:
        'createdAt,requestNo,action\n2030-01-01T00:00:00.000Z,HRB-20260308-REQ1,CREATE',
    })),
  };
  const adminSettingsServiceMock = {
    listDepartments: jest.fn(async () => ({ items: [] })),
    createDepartment: jest.fn(async () => ({
      id: 'dept-1',
      name: 'HR',
      isActive: true,
    })),
    updateDepartment: jest.fn(async (id: string) => ({
      id,
      name: 'HR',
      isActive: true,
    })),
    listProblemCategories: jest.fn(async () => ({ items: [] })),
    createProblemCategory: jest.fn(async () => ({
      id: 'pc-1',
      name: 'Leak',
      helperText: null,
      isActive: true,
    })),
    updateProblemCategory: jest.fn(async (id: string) => ({
      id,
      name: 'Leak',
      helperText: null,
      isActive: true,
    })),
    listVehicleIssueCategories: jest.fn(async () => ({ items: [] })),
    createVehicleIssueCategory: jest.fn(async () => ({
      id: 'vc-1',
      name: 'Engine',
      isActive: true,
    })),
    updateVehicleIssueCategory: jest.fn(async (id: string) => ({
      id,
      name: 'Engine',
      isActive: true,
    })),
    listOperators: jest.fn(async () => ({ items: [] })),
    createOperator: jest.fn(async () => ({
      id: 'op-1',
      displayName: 'Alice',
      isActive: true,
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
    })),
    updateOperator: jest.fn(async (id: string) => ({
      id,
      displayName: 'Alice',
      isActive: true,
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
    })),
  };

  const referenceServiceMock = {
    getDepartments: jest.fn(async () => ({
      items: [{ id: 'dept-1', name: 'HR', isActive: true }],
    })),
    getProblemCategories: jest.fn(async () => ({
      items: [{ id: 'pc-1', name: 'Leak', helperText: null, isActive: true }],
    })),
    getVehicleIssueCategories: jest.fn(async () => ({
      items: [{ id: 'vic-1', name: 'Engine', isActive: true }],
    })),
    getOperators: jest.fn(async () => ({
      items: [{ id: 'op-1', displayName: 'Alice', isActive: true }],
    })),
  };

  const notificationsServiceMock = {
    listForEmployee: jest.fn(async () => ({
      items: [
        {
          id: 'noti-1',
          eventType: 'APPROVED',
          title: 'Approved',
          message: 'Request approved',
          isRead: false,
          createdAt: new Date('2030-01-01T00:00:00.000Z'),
          readAt: null,
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
    })),
    markAsReadForEmployee: jest.fn(async () => ({ ok: true })),
    markAllAsReadForEmployee: jest.fn(async () => ({ updated: 1 })),
    listForAdmin: jest.fn(async () => ({
      items: [
        {
          id: 'noti-admin-1',
          eventType: 'MESSENGER_BOOKED',
          title: 'New booking',
          message: 'Request created',
          isRead: false,
          createdAt: new Date('2030-01-01T00:00:00.000Z'),
          readAt: null,
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
    })),
    markAsReadForAdmin: jest.fn(async () => ({ ok: true })),
    markAllAsReadForAdmin: jest.fn(async () => ({ updated: 2 })),
  };

  const maintenanceServiceMock = {
    runRetentionJob: jest.fn(async () => ({
      mode: 'manual',
      executedAt: new Date('2030-01-01T00:00:00.000Z'),
      skipped: false,
      deleted: {
        otpSessions: 1,
        employeeSessions: 2,
        notifications: 3,
        activityLogs: 4,
      },
    })),
    anonymizeRequestData: jest.fn(async (id: string) => ({
      id,
      requestNo: 'HRB-20260308-REQ1',
      status: 'DONE',
      masked: {
        requestIdentity: true,
        addressCount: 1,
        employeeNotificationCount: 2,
      },
    })),
    anonymizeSubjectData: jest.fn(async () => ({
      subject: { phone: '+66811111111', email: 'employee@cl.local' },
      requests: { count: 1, requestNos: ['HRB-20260308-REQ1'] },
      masked: { requestIdentityCount: 1, addressCount: 1 },
      deleted: { employeeSessions: 1, otpSessions: 1 },
    })),
  };
  const messengerServiceMock = {
    getByToken: jest.fn(async (token: string) => ({
      requestId: 'req-1',
      requestNo: 'HRB-20260308-REQ1',
      token,
      status: 'APPROVED',
      pickupDatetime: new Date('2030-01-01T08:00:00.000Z'),
    })),
    updateStatus: jest.fn(async () => ({
      id: 'req-1',
      status: 'IN_TRANSIT',
    })),
    reportProblem: jest.fn(async () => ({
      id: 'req-1',
      status: 'IN_TRANSIT',
    })),
    pickupEvent: jest.fn(async () => ({
      id: 'req-1',
      status: 'IN_TRANSIT',
    })),
  };

  const readinessServiceMock = {
    getReport: jest.fn(async () => ({
      ok: true,
      checkedAt: '2030-01-01T00:00:00.000Z',
      checks: [
        {
          name: 'database',
          ok: true,
          message: 'database connection is healthy',
        },
      ],
    })),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaServiceMock)
      .overrideProvider(AuthOtpService)
      .useValue(authOtpServiceMock)
      .overrideProvider(RequestsService)
      .useValue(requestsServiceMock)
      .overrideProvider(AttachmentsService)
      .useValue(attachmentsServiceMock)
      .overrideProvider(AdminRequestsService)
      .useValue(adminRequestsServiceMock)
      .overrideProvider(AdminAuthService)
      .useValue(adminAuthServiceMock)
      .overrideProvider(AdminAuditService)
      .useValue(adminAuditServiceMock)
      .overrideProvider(AdminSettingsService)
      .useValue(adminSettingsServiceMock)
      .overrideProvider(ReferenceService)
      .useValue(referenceServiceMock)
      .overrideProvider(NotificationsService)
      .useValue(notificationsServiceMock)
      .overrideProvider(MaintenanceService)
      .useValue(maintenanceServiceMock)
      .overrideProvider(MessengerService)
      .useValue(messengerServiceMock)
      .overrideProvider(ReadinessService)
      .useValue(readinessServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let cachedAdminToken: string | null = null;

  const loginAsAdmin = async () => {
    if (cachedAdminToken) {
      return cachedAdminToken;
    }

    const response = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({
        username: process.env.ADMIN_USERNAME ?? 'admin',
        password: process.env.ADMIN_PASSWORD ?? 'admin12345',
      })
      .expect(201);

    cachedAdminToken = response.body.sessionToken as string;

    return cachedAdminToken;
  };

  it('GET /health returns ok and sets request id header', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ ok: true });
        expect(res.headers['x-request-id']).toBeDefined();
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
      });
  });

  it('reuses incoming x-request-id when provided', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'client-trace-001')
      .expect(200)
      .expect((res) => {
        expect(res.headers['x-request-id']).toBe('client-trace-001');
      });
  });
  it('GET /health/db returns ok database health payload', async () => {
    await request(app.getHttpServer())
      .get('/health/db')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ ok: true, db: true });
      });

    expect(prismaServiceMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('GET /health/ready returns readiness report', async () => {
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect((res) => {
        expect(res.body.ok).toBe(true);
        expect(res.body).toHaveProperty('checkedAt');
        expect(Array.isArray(res.body.checks)).toBe(true);
      });
  });

  it('GET /health/ready returns 503 when readiness report is not ready', async () => {
    readinessServiceMock.getReport.mockResolvedValueOnce({
      ok: false,
      checkedAt: '2030-01-01T00:00:00.000Z',
      checks: [
        {
          name: 'database',
          ok: false,
          message: 'database connection failed',
        },
      ],
    });

    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503)
      .expect((res) => {
        const payload = res.body.message ?? res.body;
        expect(payload.ok).toBe(false);
        expect(Array.isArray(payload.checks)).toBe(true);
      });
  });

  it('POST /auth-otp/send returns otp session payload', async () => {
    await request(app.getHttpServer())
      .post('/auth-otp/send')
      .send({ phone: '+66811111111', email: 'employee@cl.local' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('expiresAt');
        expect(res.body).toHaveProperty('devOtp', '123456');
      });
  });

  it('POST /auth-otp/verify validates otp format', async () => {
    await request(app.getHttpServer())
      .post('/auth-otp/verify')
      .send({
        phone: '+66811111111',
        email: 'employee@cl.local',
        otpCode: '12',
      })
      .expect(400);
  });

  it('POST /requests/building validates required payload', async () => {
    await request(app.getHttpServer())
      .post('/requests/building')
      .send({ employeeName: 'John' })
      .expect(400);
  });

  it('POST /requests/building creates request on valid payload', async () => {
    await request(app.getHttpServer())
      .post('/requests/building')
      .send({
        employeeName: 'John',
        departmentId: 'dept-1',
        phone: '+66811111111',
        urgency: 'NORMAL',
        building: 'FRONT',
        floor: 2,
        locationDetail: 'Lobby',
        problemCategoryId: 'pc-1',
        description: 'Water leak',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.requestNo).toBe('HRB-20260308-REQ1');
      });

    expect(requestsServiceMock.createBuilding).toHaveBeenCalledTimes(1);
  });

  it('GET /requests/my rejects when employee session token is missing', async () => {
    await request(app.getHttpServer()).get('/requests/my').expect(401);
  });

  it('GET /requests/my returns data when employee session token is valid', async () => {
    await request(app.getHttpServer())
      .get('/requests/my')
      .set('x-employee-session-token', 'emp-valid-token')
      .expect(200)
      .expect((res) => {
        expect(res.body.total).toBe(1);
        expect(res.body.items[0].phone).toBe('+66811111111');
      });

    expect(requestsServiceMock.getMyRequests).toHaveBeenCalledWith(
      '+66811111111',
      expect.any(Object),
    );
  });

  it('POST /requests/:id/attachments/presign validates employee guard and request', async () => {
    await request(app.getHttpServer())
      .post('/requests/req-1/attachments/presign')
      .set('x-employee-session-token', 'emp-valid-token')
      .send({
        fileKind: 'DOCUMENT',
        fileName: 'invoice.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('uploadToken', 'ticket-1');
        expect(res.body).toHaveProperty('uploadUrl');
      });
  });

  it('POST /requests/:id/attachments/complete validates body', async () => {
    await request(app.getHttpServer())
      .post('/requests/req-1/attachments/complete')
      .set('x-employee-session-token', 'emp-valid-token')
      .send({})
      .expect(400);
  });
  it('GET /messenger/link returns magic link payload', async () => {
    await request(app.getHttpServer())
      .get('/messenger/link')
      .set('x-messenger-token', 'token-abc')
      .expect(200)
      .expect((res) => {
        expect(res.body.requestNo).toBe('HRB-20260308-REQ1');
      });

    expect(messengerServiceMock.getByToken).toHaveBeenCalledWith('token-abc');
  });

  it('PATCH /messenger/link/status validates status enum', async () => {
    await request(app.getHttpServer())
      .patch('/messenger/link/status')
      .set('x-messenger-token', 'token-abc')
      .send({ status: 'INVALID_STATUS' })
      .expect(400);
  });

  it('PATCH /messenger/link/status updates status', async () => {
    await request(app.getHttpServer())
      .patch('/messenger/link/status')
      .set('x-messenger-token', 'token-abc')
      .send({ status: 'IN_TRANSIT', note: 'Picked up package' })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('IN_TRANSIT');
      });
  });

  it('POST /messenger/link/report-problem validates body', async () => {
    await request(app.getHttpServer())
      .post('/messenger/link/report-problem')
      .set('x-messenger-token', 'token-abc')
      .send({})
      .expect(400);
  });

  it('POST /messenger/link/pickup-event accepts optional note', async () => {
    await request(app.getHttpServer())
      .post('/messenger/link/pickup-event')
      .set('x-messenger-token', 'token-abc')
      .send({ note: 'Package received at front desk' })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBe('req-1');
      });
  });

  it('PATCH /admin/requests/:id/status validates required operatorId', async () => {
    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .patch('/admin/requests/req-1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DONE' })
      .expect(400);
  });

  it('PATCH /admin/requests/:id/status updates status with valid payload', async () => {
    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .patch('/admin/requests/req-1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DONE', operatorId: 'op-1', note: 'Completed' })
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ id: 'req-1', status: 'DONE' });
      });

    expect(adminRequestsServiceMock.updateStatus).toHaveBeenCalledWith(
      'req-1',
      expect.objectContaining({
        status: 'DONE',
        operatorId: 'op-1',
        note: 'Completed',
      }),
    );
  });

  it('PATCH /admin/requests/:id/status returns service business error code', async () => {
    adminRequestsServiceMock.updateStatus.mockRejectedValueOnce(
      new BadRequestException({
        code: 'DIGITAL_FILE_REQUIRED_BEFORE_DONE',
        message:
          'digitalFileAttachmentId is required before DONE when deliveryMethod is DIGITAL',
      }),
    );

    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .patch('/admin/requests/req-1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DONE', operatorId: 'op-1' })
      .expect(400)
      .expect((res) => {
        expect(res.body).toMatchObject({
          code: 'DIGITAL_FILE_REQUIRED_BEFORE_DONE',
        });
      });
  });

  it('POST /admin/requests/:id/attachments/presign validates body', async () => {
    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .post('/admin/requests/req-1/attachments/presign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });

  it('POST /admin/requests/:id/attachments/presign issues admin upload ticket', async () => {
    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .post('/admin/requests/req-1/attachments/presign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fileKind: 'DOCUMENT',
        fileName: 'admin-proof.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.uploadToken).toBe('ticket-admin');
      });

    expect(attachmentsServiceMock.issueAdminUploadTicket).toHaveBeenCalledWith(
      'req-1',
      expect.objectContaining({
        fileKind: 'DOCUMENT',
        fileName: 'admin-proof.pdf',
      }),
    );
  });

  it('POST /admin/requests/:id/attachments/complete completes admin upload', async () => {
    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .post('/admin/requests/req-1/attachments/complete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uploadToken: 'ticket-admin' })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBe('att-admin-1');
      });

    expect(attachmentsServiceMock.completeAdminUpload).toHaveBeenCalledWith(
      'req-1',
      expect.objectContaining({ uploadToken: 'ticket-admin' }),
    );
  });

  it('GET /admin/settings/departments validates boolean query', async () => {
    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .get('/admin/settings/departments?isActive=maybe')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('PATCH /admin/settings/departments/:id updates with valid payload', async () => {
    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .patch('/admin/settings/departments/dept-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Human Resource', isActive: true })
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe('dept-1');
      });

    expect(adminSettingsServiceMock.updateDepartment).toHaveBeenCalledWith(
      'dept-1',
      expect.objectContaining({
        name: 'Human Resource',
        isActive: true,
      }),
    );
  });

  it('GET /admin/audit/activity-logs validates dateFrom query', async () => {
    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .get('/admin/audit/activity-logs?dateFrom=not-a-date')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('GET /admin/audit/activity-logs/export/csv validates limit upper bound', async () => {
    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .get('/admin/audit/activity-logs/export/csv?limit=10001')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('admin protected routes reject when session token is missing', async () => {
    await request(app.getHttpServer())
      .post('/admin/settings/departments')
      .send({ name: 'HR' })
      .expect(401);
  });

  it('admin can login and access protected routes', async () => {
    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .get('/admin/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.username).toBe(process.env.ADMIN_USERNAME ?? 'admin');
      });

    await request(app.getHttpServer())
      .post('/admin/settings/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'HR' })
      .expect(201)
      .expect((res) => {
        expect(res.body.name).toBe('HR');
      });

    await request(app.getHttpServer())
      .get('/admin/requests/report/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.total).toBe(0);
      });

    await request(app.getHttpServer())
      .get('/admin/requests/export/csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect('Content-Type', /text\/csv/)
      .expect((res) => {
        expect(res.text).toContain('requestNo,status');
      });

    await request(app.getHttpServer())
      .get('/admin/audit/activity-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.total).toBe(1);
      });

    await request(app.getHttpServer())
      .get('/admin/audit/activity-logs/export/csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect('Content-Type', /text\/csv/)
      .expect((res) => {
        expect(res.text).toContain('createdAt,requestNo,action');
      });

    await request(app.getHttpServer())
      .post('/admin/maintenance/retention/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201)
      .expect((res) => {
        expect(res.body.deleted.activityLogs).toBe(4);
      });

    await request(app.getHttpServer())
      .post('/admin/maintenance/pdpa/requests/req-1/anonymize')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ operatorId: 'op-1', reason: 'Employee PDPA request' })
      .expect(201)
      .expect((res) => {
        expect(res.body.masked.requestIdentity).toBe(true);
      });

    await request(app.getHttpServer())
      .post('/admin/maintenance/pdpa/subjects/anonymize')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        operatorId: 'op-1',
        phone: '+66811111111',
        email: 'employee@cl.local',
        reason: 'Employee PDPA request',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.requests.count).toBe(1);
      });
  });
  it('POST /requests/vehicle creates request on valid payload', async () => {
    await request(app.getHttpServer())
      .post('/requests/vehicle')
      .send({
        employeeName: 'John',
        departmentId: 'dept-1',
        phone: '+66811111111',
        urgency: 'NORMAL',
        vehiclePlate: '1กข1234',
        issueCategoryId: 'vic-1',
        symptom: 'Engine noise',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.requestNo).toBe('HRB-20260308-REQ2');
      });

    expect(requestsServiceMock.createVehicle).toHaveBeenCalledTimes(1);
  });

  it('POST /requests/messenger creates request on valid payload', async () => {
    await request(app.getHttpServer())
      .post('/requests/messenger')
      .send({
        employeeName: 'John',
        departmentId: 'dept-1',
        phone: '+66811111111',
        urgency: 'NORMAL',
        pickupDatetime: '2030-01-01T08:00:00.000Z',
        itemType: 'PACKAGE',
        itemDescription: 'Documents package',
        outsideBkkMetro: false,
        sender: {
          name: 'John',
          phone: '0811111111',
          province: 'Bangkok',
          district: 'Chatuchak',
          subdistrict: 'Chatuchak',
          postalCode: '10900',
          houseNo: '1/1',
        },
        receiver: {
          name: 'Jane',
          phone: '0899999999',
          province: 'Bangkok',
          district: 'Pathum Wan',
          subdistrict: 'Lumphini',
          postalCode: '10330',
          houseNo: '99',
        },
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.requestNo).toBe('HRB-20260308-REQ3');
      });

    expect(requestsServiceMock.createMessenger).toHaveBeenCalledTimes(1);
  });

  it('POST /requests/document creates request on valid payload', async () => {
    await request(app.getHttpServer())
      .post('/requests/document')
      .send({
        employeeName: 'John',
        departmentId: 'dept-1',
        phone: '0811111111',
        urgency: 'NORMAL',
        siteNameRaw: 'CL Head Office',
        documentDescription: 'Employment certificate',
        purpose: 'Bank application',
        neededDate: '2030-01-10T00:00:00.000Z',
        deliveryMethod: 'DIGITAL',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.requestNo).toBe('HRB-20260308-REQ4');
      });

    expect(requestsServiceMock.createDocument).toHaveBeenCalledTimes(1);
  });

  it('employee can get request detail and cancel request', async () => {
    await request(app.getHttpServer())
      .get('/requests/req-1')
      .set('x-employee-session-token', 'emp-valid-token')
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe('req-1');
      });

    await request(app.getHttpServer())
      .patch('/requests/req-1/cancel')
      .set('x-employee-session-token', 'emp-valid-token')
      .send({ reason: 'No longer needed' })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('CANCELED');
      });
  });

  it('employee legacy attachment add and download url routes work', async () => {
    await request(app.getHttpServer())
      .post('/requests/req-1/attachments')
      .set('x-employee-session-token', 'emp-valid-token')
      .send({
        fileKind: 'DOCUMENT',
        fileName: 'legacy-emp.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        storageKey: 'requests/req-1/legacy-emp.pdf',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBe('att-emp-legacy-1');
      });

    await request(app.getHttpServer())
      .get('/requests/req-1/attachments/att-1/download-url')
      .set('x-employee-session-token', 'emp-valid-token')
      .expect(200)
      .expect((res) => {
        expect(res.body.downloadUrl).toContain('download.example');
      });
  });

  it('admin request list/detail and attachment routes work', async () => {
    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .get('/admin/requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('items');
      });

    await request(app.getHttpServer())
      .get('/admin/requests/req-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe('req-1');
      });

    await request(app.getHttpServer())
      .post('/admin/requests/req-1/attachments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fileKind: 'DOCUMENT',
        fileName: 'legacy-admin.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        storageKey: 'requests/req-1/legacy-admin.pdf',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBe('att-admin-legacy-1');
      });

    await request(app.getHttpServer())
      .get('/admin/requests/req-1/attachments/att-admin-1/download-url')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.downloadUrl).toContain('download.example');
      });
  });

  it('admin can logout with bearer token', async () => {
    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .post('/admin/auth/logout')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201)
      .expect((res) => {
        expect(res.body.ok).toBe(true);
      });
  });

  it('admin settings endpoints for categories and operators work', async () => {
    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .get('/admin/settings/problem-categories')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.items)).toBe(true);
      });

    await request(app.getHttpServer())
      .post('/admin/settings/problem-categories')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'Leak', helperText: 'Water leak' })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBe('pc-1');
      });

    await request(app.getHttpServer())
      .patch('/admin/settings/problem-categories/pc-1')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'Leak Updated', isActive: true })
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe('pc-1');
      });

    await request(app.getHttpServer())
      .get('/admin/settings/vehicle-issue-categories')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.items)).toBe(true);
      });

    await request(app.getHttpServer())
      .post('/admin/settings/vehicle-issue-categories')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'Engine' })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBe('vc-1');
      });

    await request(app.getHttpServer())
      .patch('/admin/settings/vehicle-issue-categories/vc-1')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'Engine Updated', isActive: true })
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe('vc-1');
      });

    await request(app.getHttpServer())
      .get('/admin/settings/operators')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.items)).toBe(true);
      });

    await request(app.getHttpServer())
      .post('/admin/settings/operators')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ displayName: 'Alice' })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBe('op-1');
      });

    await request(app.getHttpServer())
      .patch('/admin/settings/operators/op-1')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ displayName: 'Alice Updated', isActive: true })
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe('op-1');
      });
  });
  it('reference endpoints return list payload and validate query', async () => {
    await request(app.getHttpServer())
      .get('/reference/departments')
      .expect(200)
      .expect((res) => {
        expect(res.body.items[0].id).toBe('dept-1');
      });

    await request(app.getHttpServer())
      .get('/reference/problem-categories')
      .expect(200)
      .expect((res) => {
        expect(res.body.items[0].id).toBe('pc-1');
      });

    await request(app.getHttpServer())
      .get('/reference/vehicle-issue-categories')
      .expect(200)
      .expect((res) => {
        expect(res.body.items[0].id).toBe('vic-1');
      });

    await request(app.getHttpServer())
      .get('/reference/operators')
      .expect(200)
      .expect((res) => {
        expect(res.body.items[0].id).toBe('op-1');
      });

    await request(app.getHttpServer())
      .get('/reference/departments?isActive=maybe')
      .expect(400);
  });

  it('notifications endpoints work for employee and admin', async () => {
    await request(app.getHttpServer())
      .get('/notifications/my')
      .set('x-employee-session-token', 'emp-valid-token')
      .expect(200)
      .expect((res) => {
        expect(res.body.total).toBe(1);
      });

    await request(app.getHttpServer())
      .patch('/notifications/my/noti-1/read')
      .set('x-employee-session-token', 'emp-valid-token')
      .expect(200)
      .expect((res) => {
        expect(res.body.ok).toBe(true);
      });

    await request(app.getHttpServer())
      .patch('/notifications/my/read-all')
      .set('x-employee-session-token', 'emp-valid-token')
      .expect(200)
      .expect((res) => {
        expect(res.body.updated).toBe(1);
      });

    const adminToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .get('/admin/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.total).toBe(1);
      });

    await request(app.getHttpServer())
      .patch('/admin/notifications/noti-admin-1/read')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.ok).toBe(true);
      });

    await request(app.getHttpServer())
      .patch('/admin/notifications/read-all')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.updated).toBe(2);
      });
  });

  it('geo endpoints return lookup data and validate required query', async () => {
    const provinceResponse = await request(app.getHttpServer())
      .get('/geo/provinces')
      .expect(200);

    expect(Array.isArray(provinceResponse.body)).toBe(true);
    expect(provinceResponse.body.length).toBeGreaterThan(0);

    await request(app.getHttpServer()).get('/geo/districts').expect(400);

    await request(app.getHttpServer())
      .get('/geo/districts?province=UnknownProvince')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });

    await request(app.getHttpServer())
      .get(
        '/geo/subdistricts?province=UnknownProvince&district=UnknownDistrict',
      )
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });

    await request(app.getHttpServer())
      .get(
        '/geo/postal-code?province=UnknownProvince&district=UnknownDistrict&subdistrict=UnknownSubdistrict',
      )
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('postalCode');
      });
  });
});
