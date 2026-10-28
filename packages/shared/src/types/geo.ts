import { z } from 'zod';
import {
  citySchema,
  districtSchema,
  geoTreeItemSchema
} from '../schemas';

export type City = z.infer<typeof citySchema>;
export type District = z.infer<typeof districtSchema>;
export type GeoTreeItem = z.infer<typeof geoTreeItemSchema>;
export type CityWithDistricts = GeoTreeItem;
