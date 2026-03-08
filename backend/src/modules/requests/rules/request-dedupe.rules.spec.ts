import {
  isDuplicateBuildingRequest,
  isDuplicateDocumentRequest,
  isDuplicateMessengerRequest,
  isDuplicateVehicleRequest,
  type RequestDedupeCandidate,
} from './request-dedupe.rules';

function baseCandidate(): RequestDedupeCandidate {
  return {
    employeeName: 'John Doe',
    departmentId: 'dept-1',
    phone: '+66811111111',
    urgency: 'NORMAL',
    buildingRepairDetail: null,
    vehicleRepairDetail: null,
    messengerBookingDetail: null,
    documentRequestDetail: null,
  } as unknown as RequestDedupeCandidate;
}

describe('request dedupe rules', () => {
  it('detects duplicate building request', () => {
    const recent = {
      ...baseCandidate(),
      buildingRepairDetail: {
        building: 'FRONT',
        floor: 2,
        locationDetail: 'Lobby East',
        problemCategoryId: 'pc-1',
        problemCategoryOther: null,
        description: 'Water leak under AC',
        additionalDetails: null,
      },
    } as unknown as RequestDedupeCandidate;

    const duplicated = isDuplicateBuildingRequest(
      {
        employeeName: ' john   doe ',
        departmentId: 'dept-1',
        phone: '+66811111111',
        urgency: 'NORMAL',
        building: 'FRONT',
        floor: 2,
        locationDetail: 'lobby east',
        problemCategoryId: 'pc-1',
        description: 'water leak under ac',
      },
      [recent],
    );

    expect(duplicated).toBe(true);
  });

  it('does not match vehicle request when symptom differs', () => {
    const recent = {
      ...baseCandidate(),
      vehicleRepairDetail: {
        vehiclePlate: 'AB-1234',
        issueCategoryId: 'vic-1',
        issueCategoryOther: null,
        symptom: 'Engine noise',
        additionalDetails: null,
      },
    } as unknown as RequestDedupeCandidate;

    const duplicated = isDuplicateVehicleRequest(
      {
        employeeName: 'John Doe',
        departmentId: 'dept-1',
        phone: '+66811111111',
        urgency: 'NORMAL',
        vehiclePlate: 'AB-1234',
        issueCategoryId: 'vic-1',
        symptom: 'Brake noise',
      },
      [recent],
    );

    expect(duplicated).toBe(false);
  });

  it('detects duplicate messenger request with same sender/receiver snapshot', () => {
    const recent = {
      ...baseCandidate(),
      messengerBookingDetail: {
        pickupDatetime: new Date('2026-03-08T14:00:00.000Z'),
        itemType: 'DOCUMENT',
        itemDescription: 'Contract papers',
        outsideBkkMetro: false,
        deliveryService: null,
        deliveryServiceOther: null,
        senderAddress: {
          name: 'Alice',
          phone: '0811111111',
          province: 'Bangkok',
          district: 'Sathon',
          subdistrict: 'Yan Nawa',
          postalCode: '10120',
          houseNo: '88/1',
          soi: null,
          road: null,
          extra: null,
        },
        receiverAddress: {
          name: 'Bob',
          phone: '0822222222',
          province: 'Bangkok',
          district: 'Bang Rak',
          subdistrict: 'Si Phraya',
          postalCode: '10500',
          houseNo: '22',
          soi: null,
          road: null,
          extra: null,
        },
      },
    } as unknown as RequestDedupeCandidate;

    const duplicated = isDuplicateMessengerRequest(
      {
        employeeName: 'John Doe',
        departmentId: 'dept-1',
        phone: '+66811111111',
        urgency: 'NORMAL',
        pickupDatetime: '2026-03-08T14:00:00.000Z',
        itemType: 'DOCUMENT',
        itemDescription: 'contract papers',
        outsideBkkMetro: false,
        sender: {
          name: 'Alice',
          phone: '0811111111',
          province: 'Bangkok',
          district: 'Sathon',
          subdistrict: 'Yan Nawa',
          postalCode: '10120',
          houseNo: '88/1',
        },
        receiver: {
          name: 'Bob',
          phone: '0822222222',
          province: 'Bangkok',
          district: 'Bang Rak',
          subdistrict: 'Si Phraya',
          postalCode: '10500',
          houseNo: '22',
        },
      },
      [recent],
    );

    expect(duplicated).toBe(true);
  });

  it('does not match postal document request when address snapshot differs', () => {
    const recent = {
      ...baseCandidate(),
      documentRequestDetail: {
        siteNameNormalized: 'site a',
        documentDescription: 'Certificate',
        purpose: 'Bank submission',
        neededDate: new Date('2026-03-10T00:00:00.000Z'),
        deliveryMethod: 'POSTAL',
        note: null,
        deliveryAddress: {
          name: 'John Doe',
          phone: '0811111111',
          province: 'Bangkok',
          district: 'Sathon',
          subdistrict: 'Yan Nawa',
          postalCode: '10120',
          houseNo: '10',
          soi: null,
          road: null,
          extra: null,
        },
      },
    } as unknown as RequestDedupeCandidate;

    const duplicated = isDuplicateDocumentRequest(
      {
        employeeName: 'John Doe',
        departmentId: 'dept-1',
        phone: '+66811111111',
        urgency: 'NORMAL',
        siteNameRaw: 'Site A',
        documentDescription: 'Certificate',
        purpose: 'Bank submission',
        neededDate: '2026-03-10T00:00:00.000Z',
        deliveryMethod: 'POSTAL',
        deliveryAddress: {
          name: 'John Doe',
          phone: '0811111111',
          province: 'Bangkok',
          district: 'Sathon',
          subdistrict: 'Yan Nawa',
          postalCode: '10120',
          houseNo: '99',
        },
      },
      [recent],
    );

    expect(duplicated).toBe(false);
  });
});
