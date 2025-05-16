import { Maybe } from "../../utils/ts-utils";
import { FutureData } from "../entities/FutureData";
import { RefinedModel, RefinedModelType } from "../entities/RefinedModel";

export interface RefinedModelRepository {
    getBy(args: RefinedModelGetArgs): FutureData<RefinedModel>;
}

export interface RefinedModelGetArgs {
    pdbId: string;
    emdbId: Maybe<string>;
    method: RefinedModelType;
}

export const refinedModelArgsToString = (args: RefinedModelGetArgs) =>
    `${[args.pdbId, args.emdbId, args.method].filter(Boolean).join(", ")}`;
