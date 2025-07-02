import { Maybe } from "../../utils/ts-utils";
import { FutureData } from "../entities/FutureData";
import { refinedMethods, RefinedModel, RefinedModelType } from "../entities/RefinedModel";

export interface RefinedModelRepository {
    getBy(args: RefinedModelGetArgs): FutureData<RefinedModel>;
}

export interface RefinedModelGetArgs {
    pdbId: string;
    emdbId: Maybe<string>;
    method: RefinedModelType;
}

export const refinedModelArgsToString = (args: RefinedModelGetArgs) =>
    `${[refinedMethods[args.method], args.pdbId, args.emdbId ? `EMD-${args.emdbId}` : undefined]
        .filter(Boolean)
        .join(", ")}`;
