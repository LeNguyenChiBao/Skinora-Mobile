const BASE_URL = 'https://production.cas.so/address-kit/2025-07-01';

interface Province {
  code: string;
  name: string;
  englishName: string;
  administrativeLevel: string;
  decree: string;
}

interface Commune {
  code: string;
  name: string;
  englishName: string;
  administrativeLevel: string;
  provinceCode: string;
  provinceName: string;
  decree: string;
}

interface ProvinceResponse {
  requestId: string;
  provinces: Province[];
}

interface CommuneResponse {
  requestId: string;
  communes: Commune[];
}

export const addressService = {
  async getProvinces(): Promise<Province[]> {
    try {
      const response = await fetch(`${BASE_URL}/provinces`);
      const data: ProvinceResponse = await response.json();
      return data.provinces;
    } catch (error) {
      console.error('Error fetching provinces:', error);
      throw error;
    }
  },

  async getCommunesByProvince(provinceCode: string): Promise<Commune[]> {
    try {
      const response = await fetch(`${BASE_URL}/provinces/${provinceCode}/communes`);
      const data: CommuneResponse = await response.json();
      return data.communes;
    } catch (error) {
      console.error('Error fetching communes:', error);
      throw error;
    }
  },

  async getAllCommunes(): Promise<Commune[]> {
    try {
      const response = await fetch(`${BASE_URL}/communes`);
      const data: CommuneResponse = await response.json();
      return data.communes;
    } catch (error) {
      console.error('Error fetching all communes:', error);
      throw error;
    }
  }
};
