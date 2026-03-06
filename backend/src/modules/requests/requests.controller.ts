import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RequestsService } from './requests.service';

import { CreateBuildingRequestDto } from './dto/create-building-request.dto';
import { CreateVehicleRequestDto } from './dto/create-vehicle-request.dto';
import { CreateMessengerRequestDto } from './dto/create-messenger-request.dto';
import { CreateDocumentRequestDto } from './dto/create-document-request.dto';
import { EmployeeSession } from '../auth-otp/employee-session.decorator';
import { EmployeeSessionGuard } from '../auth-otp/employee-session.guard';
import type { EmployeeSessionPrincipal } from '../auth-otp/employee-session.types';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

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
  @Get('my')
  myRequests(@EmployeeSession() session: EmployeeSessionPrincipal) {
    return this.requestsService.getMyRequests(session.phone);
  }

  @UseGuards(EmployeeSessionGuard)
  @Get(':id')
  detail(@Param('id') id: string, @EmployeeSession() session: EmployeeSessionPrincipal) {
    return this.requestsService.getRequestDetail(id, session.phone);
  }
}