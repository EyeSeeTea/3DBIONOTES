import { FutureData } from "../entities/FutureData";
import { RefinedModel } from "../entities/RefinedModel";
import {
    RefinedModelGetArgs,
    RefinedModelRepository,
} from "../repositories/RefinedModelRepository";

export class GetRefinedModelUseCase {
    constructor(private refinedModelRepository: RefinedModelRepository) {}

    execute(args: RefinedModelGetArgs): FutureData<RefinedModel> {
        return this.refinedModelRepository.getBy(args);
    }
}
