import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateAttachmentDto } from '../attachments/dto/create-attachment.dto';
import { AttachmentsService } from '../attachments/attachments.service';
import { EmployeeSession } from '../auth-otp/employee-session.decorator';
import { EmployeeSessionGuard } from '../auth-otp/employee-session.guard';
import type { EmployeeSessionPrincipal } from '../auth-otp/employee-session.types';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { CreateBuildingRequestDto } from './dto/create-building-request.dto';
import { CreateDocumentRequestDto } from './dto/create-document-request.dto';
import { CreateMessengerRequestDto } from './dto/create-messenger-request.dto';
import { CreateVehicleRequestDto } from './dto/create-vehicle-request.dto';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @Post('building')
  createBuilding(@Body() dto: CreateBuildingRequestDto) {
    return this.requestsService.createBuilding(dto);
  }

  @Post('vehicle')
  createVehicle(@Body() dto: CreateVehicleRequestDto) {
    return this.requestsService.createVehicle(dto);
  }

  @Post('messenger')
  createMessenger(@Body() dto: CreateMessengerRequestDto) {
    return this.requestsService.createMessenger(dto);
  }

  @Post('document')
  createDocument(@Body() dto: CreateDocumentRequestDto) {
    return this.requestsService.createDocument(dto);
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
  myRequests(@EmployeeSession() session: EmployeeSessionPrincipal) {
    return this.requestsService.getMyRequests(session.phone);
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
