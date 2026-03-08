export type GeoCompiled = {
  provinces: Array<{
    name: string;
    code: string;
    districts: Array<{
      name: string;
      code: string;
      subdistricts: Array<{
        name: string;
        code: string;
        postalCode: string;
      }>;
    }>;
  }>;
};
