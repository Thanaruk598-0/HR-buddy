import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RateLimitPolicy } from '../../common/security/rate-limit.decorator';
import { CompleteAttachmentUploadDto } from '../attachments/dto/complete-attachment-upload.dto';
import { CreateAttachmentDto } from '../attachments/dto/create-attachment.dto';
import { CreateAttachmentUploadTicketDto } from '../attachments/dto/create-attachment-upload-ticket.dto';
import { AttachmentDownloadUrlQueryDto } from '../attachments/dto/attachment-download-url.query.dto';
import { AttachmentsService } from '../attachments/attachments.service';
import { EmployeeSession } from '../auth-otp/employee-session.decorator';
import { EmployeeSessionGuard } from '../auth-otp/employee-session.guard';
import type { EmployeeSessionPrincipal } from '../auth-otp/employee-session.types';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { CreateBuildingRequestDto } from './dto/create-building-request.dto';
import { CreateDocumentRequestDto } from './dto/create-document-request.dto';
import { CreateMessengerRequestDto } from './dto/create-messenger-request.dto';
import { CreateVehicleRequestDto } from './dto/create-vehicle-request.dto';
import { MyRequestsQueryDto } from './dto/my-requests.query.dto';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @RateLimitPolicy('requestCreate')
  @Post('building')
  createBuilding(@Body() dto: CreateBuildingRequestDto) {
    return this.requestsService.createBuilding(dto);
  }

  @RateLimitPolicy('requestCreate')
  @Post('vehicle')
  createVehicle(@Body() dto: CreateVehicleRequestDto) {
    return this.requestsService.createVehicle(dto);
  }

  @RateLimitPolicy('requestCreate')
  @Post('messenger')
  createMessenger(@Body() dto: CreateMessengerRequestDto) {
    return this.requestsService.createMessenger(dto);
  }

  @RateLimitPolicy('requestCreate')
  @Post('document')
  createDocument(@Body() dto: CreateDocumentRequestDto) {
    return this.requestsService.createDocument(dto);
  }

  @UseGuards(EmployeeSessionGuard)
  @Post(':id/attachments/presign')
  presignAttachment(
    @Param('id') id: string,
    @Body() dto: CreateAttachmentUploadTicketDto,
    @EmployeeSession() session: EmployeeSessionPrincipal,
  ) {
    return this.attachmentsService.issueEmployeeUploadTicket(
      id,
      session.phone,
      dto,
    );
  }

  @UseGuards(EmployeeSessionGuard)
  @Post(':id/attachments/complete')
  completeAttachment(
    @Param('id') id: string,
    @Body() dto: CompleteAttachmentUploadDto,
    @EmployeeSession() session: EmployeeSessionPrincipal,
  ) {
    return this.attachmentsService.completeEmployeeUpload(
      id,
      session.phone,
      dto,
    );
  }

  @UseGuards(EmployeeSessionGuard)
  @Get(':id/attachments/:attachmentId/download-url')
  downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Query() query: AttachmentDownloadUrlQueryDto,
    @EmployeeSession() session: EmployeeSessionPrincipal,
  ) {
    return this.attachmentsService.getEmployeeDownloadUrl(
      id,
      attachmentId,
      session.phone,
      query.mode,
    );
  }

  @UseGuards(EmployeeSessionGuard)
  @Post(':id/attachments')
  addAttachment(
    @Param('id') id: string,
    @Body() dto: CreateAttachmentDto,
    @EmployeeSession() session: EmployeeSessionPrincipal,
  ) {
    return this.attachmentsService.addEmployeeAttachment(
      id,
      session.phone,
      dto,
    );
  }

  @UseGuards(EmployeeSessionGuard)
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelRequestDto,
    @EmployeeSession() session: EmployeeSessionPrincipal,
  ) {
    return this.requestsService.cancelRequest(id, session.phone, dto.reason);
  }

  @UseGuards(EmployeeSessionGuard)
  @Get('my')
  myRequests(
    @EmployeeSession() session: EmployeeSessionPrincipal,
    @Query() q: MyRequestsQueryDto,
  ) {
    return this.requestsService.getMyRequests(session.phone, q);
  }

  @UseGuards(EmployeeSessionGuard)
  @Get(':id')
  detail(
    @Param('id') id: string,
    @EmployeeSession() session: EmployeeSessionPrincipal,
  ) {
    return this.requestsService.getRequestDetail(id, session.phone);
  }
}
