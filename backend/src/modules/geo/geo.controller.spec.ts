import { BadRequestException } from '@nestjs/common';
import { GeoController } from './geo.controller';

describe('GeoController', () => {
  const geoService = {
    getProvinces: jest.fn(),
    getDistricts: jest.fn(),
    getSubdistricts: jest.fn(),
    getPostalCode: jest.fn(),
  };

  let controller: GeoController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new GeoController(geoService as never);
  });

  it('rejects blank district query params', () => {
    expect(() => controller.districts('   ')).toThrow(BadRequestException);
  });

  it('trims district query before delegating to service', () => {
    geoService.getDistricts.mockReturnValue([]);

    controller.districts('  Bangkok  ');

    expect(geoService.getDistricts).toHaveBeenCalledWith('Bangkok');
  });

  it('trims all postal-code query params before delegating', () => {
    geoService.getPostalCode.mockReturnValue('10330');

    const result = controller.postalCode(
      '  Bangkok ',
      ' Pathum Wan ',
      ' Lumphini ',
    );

    expect(geoService.getPostalCode).toHaveBeenCalledWith(
      'Bangkok',
      'Pathum Wan',
      'Lumphini',
    );
    expect(result).toEqual({ postalCode: '10330' });
  });
});
