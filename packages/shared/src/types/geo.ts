import { z } from 'zod';
import {
  citySchema,
  districtSchema,
  geoTreeItemSchema,
  createCitySchema,
  updateCitySchema,
  createDistrictSchema,
  updateDistrictSchema,
  toggleGeoActiveSchema,
  adminGeoQuerySchema
} from '../schemas';

export type City = z.infer<typeof citySchema>;
export type District = z.infer<typeof districtSchema>;
export type GeoTreeItem = z.infer<typeof geoTreeItemSchema>;
export type CityWithDistricts = GeoTreeItem;

export type CreateCityInput = z.infer<typeof createCitySchema>;
export type UpdateCityInput = z.infer<typeof updateCitySchema>;
export type CreateDistrictInput = z.infer<typeof createDistrictSchema>;
export type UpdateDistrictInput = z.infer<typeof updateDistrictSchema>;
export type ToggleGeoActiveInput = z.infer<typeof toggleGeoActiveSchema>;
export type AdminGeoQueryInput = z.infer<typeof adminGeoQuerySchema>;

export interface AdminCityListItem {
  id: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  createdAt: string | Date;
  _count: {
    districts: number;
  };
  activeDistrictsCount: number;
  inactiveDistrictsCount: number;
}

export interface AdminDistrictListItem {
  id: string;
  cityId: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  createdAt: string | Date;
}
