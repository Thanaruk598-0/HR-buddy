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
import { AdminSettingsService } from '../src/modules/admin-settings/admin-settings.service';
import { AttachmentsService } from '../src/modules/attachments/attachments.service';
import { AuthOtpService } from '../src/modules/auth-otp/auth-otp.service';
import { MaintenanceService } from '../src/modules/maintenance/maintenance.service';
import { MessengerService } from '../src/modules/messenger/messenger.service';
import { RequestsService } from '../src/modules/requests/requests.service';

describe('HR Buddy API (e2e)', () => {
  let app: INestApplication;

  const employeeSession = {
    id: 'sess-1',
    phone: '+66811111111',
    email: 'employee@cl.local',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
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
    createVehicle: jest.fn(),
    createMessenger: jest.fn(),
    createDocument: jest.fn(),
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
    addEmployeeAttachment: jest.fn(),
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
    addAdminAttachment: jest.fn(),
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
      .overrideProvider(AuthOtpService)
      .useValue(authOtpServiceMock)
      .overrideProvider(RequestsService)
      .useValue(requestsServiceMock)
      .overrideProvider(AttachmentsService)
      .useValue(attachmentsServiceMock)
      .overrideProvider(AdminRequestsService)
      .useValue(adminRequestsServiceMock)
      .overrideProvider(AdminAuditService)
      .useValue(adminAuditServiceMock)
      .overrideProvider(AdminSettingsService)
      .useValue(adminSettingsServiceMock)
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
  const loginAsAdmin = async () => {
    const response = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ username: 'admin', password: 'admin12345' })
      .expect(201);

    return response.body.sessionToken as string;
  };

  it('GET /health returns ok and sets request id header', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ ok: true });
        expect(res.headers['x-request-id']).toBeDefined();
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
  it('GET /messenger/link/:token returns magic link payload', async () => {
    await request(app.getHttpServer())
      .get('/messenger/link/token-abc')
      .expect(200)
      .expect((res) => {
        expect(res.body.requestNo).toBe('HRB-20260308-REQ1');
      });

    expect(messengerServiceMock.getByToken).toHaveBeenCalledWith('token-abc');
  });

  it('PATCH /messenger/link/:token/status validates status enum', async () => {
    await request(app.getHttpServer())
      .patch('/messenger/link/token-abc/status')
      .send({ status: 'INVALID_STATUS' })
      .expect(400);
  });

  it('PATCH /messenger/link/:token/status updates status', async () => {
    await request(app.getHttpServer())
      .patch('/messenger/link/token-abc/status')
      .send({ status: 'IN_TRANSIT', note: 'Picked up package' })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('IN_TRANSIT');
      });
  });

  it('POST /messenger/link/:token/report-problem validates body', async () => {
    await request(app.getHttpServer())
      .post('/messenger/link/token-abc/report-problem')
      .send({})
      .expect(400);
  });

  it('POST /messenger/link/:token/pickup-event accepts optional note', async () => {
    await request(app.getHttpServer())
      .post('/messenger/link/token-abc/pickup-event')
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
        expect(res.body.username).toBe('admin');
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
});
