import { Maybe } from "../../utils/ts-utils";
import { SourceName } from "./Source";

export const refinedModelsType = ["pdbRedo", "isolde", "refmac", "phenix"] as const;
export type RefinedModelType = typeof refinedModelsType[number];

export type RefinedModel = {
    filenameUrl: Maybe<string>; // Some model files might not be available per failed jobs
    method: RefinedModelType;
    source: SourceName;
    externalLink: string;
};

export function typeIsRefinedModelType(type: string): type is RefinedModelType {
    return refinedModelsType.includes(type as RefinedModelType);
}

export enum refinedMethods {
    pdbRedo = "PDB-Redo",
    isolde = "Isolde",
    refmac = "Refmac",
    phenix = "PHENIX",
}
