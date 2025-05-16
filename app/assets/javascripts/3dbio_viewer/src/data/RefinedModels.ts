import { Codec, GetType, string } from "purify-ts";

export const refinedModelCodec = Codec.interface({
    source: string,
    method: string,
    filename: string,
    externalLink: string,
    details: string, // ""
});

export type RefinedModelCodec = GetType<typeof refinedModelCodec>;
