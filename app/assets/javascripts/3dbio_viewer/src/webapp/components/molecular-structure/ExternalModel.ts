import _ from "lodash";
import { CompositionRoot } from "../../../compositionRoot";
import { RefinedModelType } from "../../../domain/entities/RefinedModel";
import { RefinedModelGetArgs } from "../../../domain/repositories/RefinedModelRepository";
import { DbItem, getRefinedModelIds } from "../../view-models/Selection";
import { checkModelUrl } from "./usePdbPluginHelpers";
import { isDev } from "../../../routes";

export class ExternalModel {
    constructor(private compositionRoot: CompositionRoot) {}

    // Arrow function -> Safe use of "this" if the method is used as a callback
    getRefinedModelUrl = async (args: RefinedModelGetArgs): Promise<string> => {
        return this.compositionRoot.getRefinedModel
            .execute(args)
            .map(refinedModel => refinedModel.filenameUrl)
            .toPromise()
            .then(url => {
                if (!url) return Promise.reject(new Error("Refined model URL is not available"));
                else if (!this.refinedModelUrlIsValidUrl(url))
                    return Promise.reject(new Error("Invalid refined model URL"));
                else return url;
            });
    };

    async filterOnlyValidRefinedModels(args: {
        refinedModels: DbItem<RefinedModelType>[];
        onUrlRetrievalFailure: (args: RefinedModelGetArgs) => void;
        onFetchFailure: (args: RefinedModelGetArgs) => void;
    }): Promise<DbItem<RefinedModelType>[]> {
        const { refinedModels, onUrlRetrievalFailure, onFetchFailure } = args;
        return this.validateRefinedModels({
            refinedModels,
            onUrlRetrievalFailure,
            onFetchFailure,
        }).then(results => _.compact(results));
    }

    private async validateRefinedModels(args: {
        refinedModels: DbItem<RefinedModelType>[];
        onUrlRetrievalFailure: (args: RefinedModelGetArgs) => void;
        onFetchFailure: (args: RefinedModelGetArgs) => void;
    }): Promise<(DbItem<RefinedModelType> | false)[]> {
        const { refinedModels, onUrlRetrievalFailure, onFetchFailure } = args;
        const promises = refinedModels.map(model => {
            return this.validateRefinedModel({
                model,
                onUrlRetrievalFailure,
                onFetchFailure,
            }).then(valid => (valid ? model : false));
        });

        return Promise.allSettled(promises).then(results =>
            results.map(result => (result.status === "fulfilled" ? result.value : false))
        );
    }

    private refinedModelUrlIsValidUrl(url: string): boolean {
        const cciProxiedUrl = /^\/cci\/[^\s]*$/i.test(url);
        if (isDev && cciProxiedUrl) return true; // In dev mode, allow CCI proxied URLs
        return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url);
    }

    private async validateRefinedModel(args: {
        model: DbItem<RefinedModelType>;
        onUrlRetrievalFailure: (args: RefinedModelGetArgs) => void;
        onFetchFailure: (args: RefinedModelGetArgs) => void;
    }) {
        const { model, onUrlRetrievalFailure, onFetchFailure } = args;
        const { pdbId, emdbId } = getRefinedModelIds(model);
        const modelArgs = {
            pdbId: pdbId,
            emdbId: emdbId,
            method: model.type,
        };

        const filenameUrl = await this.getRefinedModelUrl(modelArgs).catch(err => {
            onUrlRetrievalFailure(modelArgs);
            return Promise.reject(err);
        });

        const resourceAvailable = await checkModelUrl({
            id: pdbId,
            url: filenameUrl,
        })
            .then(res => {
                if (res.loaded) return true;
                else onFetchFailure(modelArgs);
            })
            .catch(err => {
                onFetchFailure(modelArgs);
                return Promise.reject(err);
            });

        return Boolean(resourceAvailable);
    }
}
