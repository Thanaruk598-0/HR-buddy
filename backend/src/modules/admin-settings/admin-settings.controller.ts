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
import { AdminSessionGuard } from '../admin-auth/admin-session.guard';
import { AdminSettingsService } from './admin-settings.service';
import { AdminSettingsListQueryDto } from './dto/admin-settings-list.query.dto';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { CreateOperatorDto, UpdateOperatorDto } from './dto/operator.dto';
import {
  CreateProblemCategoryDto,
  UpdateProblemCategoryDto,
} from './dto/problem-category.dto';
import {
  CreateVehicleIssueCategoryDto,
  UpdateVehicleIssueCategoryDto,
} from './dto/vehicle-issue-category.dto';

@Controller('admin/settings')
@UseGuards(AdminSessionGuard)
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  @Get('departments')
  listDepartments(@Query() q: AdminSettingsListQueryDto) {
    return this.settingsService.listDepartments(q);
  }

  @Post('departments')
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.settingsService.createDepartment(dto);
  }

  @Patch('departments/:id')
  updateDepartment(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.settingsService.updateDepartment(id, dto);
  }

  @Get('problem-categories')
  listProblemCategories(@Query() q: AdminSettingsListQueryDto) {
    return this.settingsService.listProblemCategories(q);
  }

  @Post('problem-categories')
  createProblemCategory(@Body() dto: CreateProblemCategoryDto) {
    return this.settingsService.createProblemCategory(dto);
  }

  @Patch('problem-categories/:id')
  updateProblemCategory(
    @Param('id') id: string,
    @Body() dto: UpdateProblemCategoryDto,
  ) {
    return this.settingsService.updateProblemCategory(id, dto);
  }

  @Get('vehicle-issue-categories')
  listVehicleIssueCategories(@Query() q: AdminSettingsListQueryDto) {
    return this.settingsService.listVehicleIssueCategories(q);
  }

  @Post('vehicle-issue-categories')
  createVehicleIssueCategory(@Body() dto: CreateVehicleIssueCategoryDto) {
    return this.settingsService.createVehicleIssueCategory(dto);
  }

  @Patch('vehicle-issue-categories/:id')
  updateVehicleIssueCategory(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleIssueCategoryDto,
  ) {
    return this.settingsService.updateVehicleIssueCategory(id, dto);
  }

  @Get('operators')
  listOperators(@Query() q: AdminSettingsListQueryDto) {
    return this.settingsService.listOperators(q);
  }

  @Post('operators')
  createOperator(@Body() dto: CreateOperatorDto) {
    return this.settingsService.createOperator(dto);
  }

  @Patch('operators/:id')
  updateOperator(@Param('id') id: string, @Body() dto: UpdateOperatorDto) {
    return this.settingsService.updateOperator(id, dto);
  }
}
