import { SourceName } from "./Source";

export const refinedModelsType = ["pdbRedo", "isolde", "refmac", "phenix"] as const;
export type RefinedModelType = typeof refinedModelsType[number];

export type RefinedModel = {
    filenameUrl: string;
    method: RefinedModelType;
    source: SourceName;
    externalLink: string;
};

export function typeIsRefinedModelType(type: string): type is RefinedModelType {
    return refinedModelsType.includes(type as RefinedModelType);
}
