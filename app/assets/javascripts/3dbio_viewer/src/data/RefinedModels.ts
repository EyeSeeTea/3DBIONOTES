import { Codec, enumeration, exactly, GetType, string } from "purify-ts";
import { RefinedModelType } from "../domain/entities/RefinedModel";
import _ from "lodash";
import { getKeys } from "../utils/ts-utils";

enum refinedMethods {
    pdbRedo = "PDB-Redo",
    isolde = "Isolde",
    refmac = "Refmac",
    phenix = "PHENIX",
}

export const refinedModelCodec = Codec.interface({
    source: exactly("CERES", "CSTF", "PDB-REDO"),
    method: enumeration(refinedMethods),
    filename: string,
    externalLink: string,
    details: string, // ""
});

export function mapRefinedModelMethod(method: refinedMethods): RefinedModelType {
    const key = getKeys(refinedMethods).find(key => refinedMethods[key] === method);
    if (!key) throw new Error(`Unknown refined method: ${method}`);
    return key;
}

export type RefinedModelCodec = GetType<typeof refinedModelCodec>;
