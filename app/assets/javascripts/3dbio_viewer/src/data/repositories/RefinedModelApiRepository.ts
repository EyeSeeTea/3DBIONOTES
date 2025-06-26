import { FutureData } from "../../domain/entities/FutureData";
import { refinedMethods, RefinedModel } from "../../domain/entities/RefinedModel";
import {
    refinedModelArgsToString,
    RefinedModelGetArgs,
    RefinedModelRepository,
} from "../../domain/repositories/RefinedModelRepository";
import i18n from "../../domain/utils/i18n";
import { routes } from "../../routes";
import { Future } from "../../utils/future";
import { getResults, paginationCodec } from "../codec-utils";
import { mapRefinedModelMethod, refinedModelCodec } from "../RefinedModels";
import { getValidatedJSON } from "../request-utils";

const REFINED_MODELS_ENDPOINT = `${routes.bionotes}/bws/api/refinedModels/`;

export class RefinedModelApiRepository implements RefinedModelRepository {
    getBy(args: RefinedModelGetArgs): FutureData<RefinedModel> {
        const { pdbId, emdbId, method } = args;
        const emdbParam = emdbId ? `&emdbId=EMD-${emdbId}` : "";
        const url = `${REFINED_MODELS_ENDPOINT}?pdbId=${pdbId.toUpperCase()}${emdbParam}&methodType=${
            refinedMethods[method]
        }`;

        console.debug("Requesting refined model URL from endpoint: " + url);

        const refinedModels$ = getValidatedJSON(url, paginationCodec(refinedModelCodec))
            .map(getResults)
            .flatMap(
                (refinedModels): FutureData<RefinedModel> => {
                    const coincidence = refinedModels[0];
                    if (!coincidence)
                        return Future.error({
                            message: i18n.t(
                                `Refined model not found: ${refinedModelArgsToString(args)}`
                            ),
                        });

                    if (refinedModels.length > 1) {
                        console.warn(
                            `Multiple refined models found for ${pdbId} with emdbId ${
                                emdbId ?? "NULL"
                            } and methodType ${method}. Using the first one.`
                        );
                    }

                    return Future.success({
                        source: coincidence.source,
                        method: mapRefinedModelMethod(coincidence.method),
                        externalLink: coincidence.externalLink,
                        filenameUrl: coincidence.filename?.replaceAll(
                            "https://cci.lbl.gov/static/data/",
                            "/cci/"
                        ),
                    });
                }
            );

        return refinedModels$;
    }
}
