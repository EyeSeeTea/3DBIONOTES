import _ from "lodash";
import { PDBeMolstarPlugin } from "@3dbionotes/pdbe-molstar/lib";
import { RefinedModelGetArgs } from "../../../domain/repositories/RefinedModelRepository";
import { errorsKeys, loaderErrors } from "./usePdbPluginHelpers";
import { I18N } from "../../../domain/utils/i18n";

//TODO: errors to move here
export class PluginFeedback {
    constructor(private pdbePlugin: PDBeMolstarPlugin, private i18n: I18N) {}

    getActions(): PluginFeedbackActions {
        return {
            error: {
                whileRetrievingRefinedModelUrl: (args: RefinedModelGetArgs) =>
                    this.failureWhileRetrievingRefinedModelUrl(args),
                whileFetchingRefinedModelUrl: (args: RefinedModelGetArgs) =>
                    this.failureWhileFetchingRefinedModelUrl(args),
            },
        };
    }

    failureWhileRetrievingRefinedModelUrl(args: RefinedModelGetArgs) {
        this.pdbePlugin.canvas.showToast({
            title: this.i18n.t("Error"),
            message: loaderErrors.refinedModelUnableToFindModelUrl(args),
            key: errorsKeys.refinedModelUnableToFindModelUrl,
        });
    }

    failureWhileFetchingRefinedModelUrl(args: RefinedModelGetArgs) {
        this.pdbePlugin.canvas.showToast({
            title: this.i18n.t("Error"),
            message: loaderErrors.refinedModelUnableToFetch(args),
            key: errorsKeys.refinedModelUnableToFetch,
        });
    }
}

type PluginFeedbackActions = {
    error: {
        whileRetrievingRefinedModelUrl: (args: RefinedModelGetArgs) => void;
        whileFetchingRefinedModelUrl: (args: RefinedModelGetArgs) => void;
    };
};

export const pluginFeedbackVoidActions: PluginFeedbackActions = {
    error: {
        whileRetrievingRefinedModelUrl: _.noop,
        whileFetchingRefinedModelUrl: _.noop,
    },
};
