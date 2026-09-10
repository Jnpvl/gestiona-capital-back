import {
  listStpsOccupations,
  listStpsThematicAreas,
} from "../repositories/stps.repository";

export class StpsService {
  async listOccupations(search?: string) {
    const occupations = await listStpsOccupations(search);
    return { occupations };
  }

  async listThematicAreas(search?: string) {
    const thematicAreas = await listStpsThematicAreas(search);
    return { thematicAreas };
  }
}

export const stpsService = new StpsService();
