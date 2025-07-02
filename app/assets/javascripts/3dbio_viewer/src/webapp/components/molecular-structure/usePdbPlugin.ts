import _ from "lodash";
import React from "react";
import { PDBeMolstarPlugin } from "@3dbionotes/pdbe-molstar/lib";
import {
    emptySelection,
    getMainChanges,
    getMainItem,
    Selection,
    setMainItem,
} from "../../view-models/Selection";
import { RefinedModelGetArgs } from "../../../domain/repositories/RefinedModelRepository";
import { debugVariable } from "../../../utils/debug";
import { useReference } from "../../hooks/use-reference";
import { useAppContext } from "../AppContext";
import { PdbInfo } from "../../../domain/entities/PdbInfo";
import { routes } from "../../../routes";
import { MolecularStructureProps } from "./MolecularStructure";
import { MolstarState } from "./MolstarState";
import { loaderKeys } from "../RootViewerContents";
import { usePluginRef } from "./usePluginRef";
import {
    applySelectionChangesToPlugin,
    checkUploadedModelUrl,
    errorsKeys,
    loaderErrors,
} from "./usePdbPluginHelpers";
import { PdbMolstarPlugin, pdbMolstarVoidActions } from "./PdbMolstarPlugin";
import { ExternalModel } from "./ExternalModel";
import { PluginFeedback, pluginFeedbackVoidActions } from "./PluginFeedback";
import i18n from "../../utils/i18n";
import "./molstar.css";
import "./molstar-light.css";

export function usePdbePlugin(options: MolecularStructureProps) {
    const {
        selection: newSelection,
        onSelectionChange: setSelection,
        onLigandsLoaded,
        updateLoader,
        loaderBusy,
        proteinId,
        pdbInfo,
    } = options;
    const { proteinNetwork } = options;
    const { compositionRoot } = useAppContext();
    const [pdbePlugin0, setPdbePlugin] = React.useState<PDBeMolstarPlugin>();
    const [pluginLoad, setPluginLoad] = React.useState<Date>();
    const molstarState = React.useRef<MolstarState>({ type: "pdb", items: [], chainId: undefined });
    const pdbePlugin = pdbePlugin0 && pluginLoad ? pdbePlugin0 : undefined;
    const chainId = newSelection.chainId;
    const ligandId = newSelection.ligandId;
    const pdbMolstarPlugin = React.useMemo(() => pdbePlugin && new PdbMolstarPlugin(pdbePlugin), [
        pdbePlugin,
    ]);

    const chains = React.useMemo(() => pdbInfo?.chains ?? [], [pdbInfo?.chains]);
    const chainsRef = React.useRef<PdbInfo["chains"]>([]);

    const externalModel = React.useMemo(
        () => compositionRoot && new ExternalModel(compositionRoot),
        [compositionRoot]
    );

    const pluginFeedback = React.useMemo(() => pdbePlugin && new PluginFeedback(pdbePlugin, i18n), [
        pdbePlugin,
    ]);

    // Keep a reference containing the previous value of selection. We need this value to diff
    // the new state against the old state and perform imperative operations (add/remove/update)
    // on the plugin.
    const [prevSelectionRef, setPrevSelection] = useReference<Selection>();
    const [uploadDataToken, extension] =
        newSelection.type === "uploadData" ? [newSelection.token, newSelection.extension] : [];

    // const somePdbInfo= React.useMemo(() => {
    //     return {
    //         function: ()=>{},
    //     }},[]);

    // React.useEffect(() => somePdbInfo.function, [somePdbInfo]);

    const pdbMolstarActions = React.useMemo(
        () => pdbMolstarPlugin?.getActions() ?? pdbMolstarVoidActions,
        [pdbMolstarPlugin]
    );

    const pluginFeedbackActions = React.useMemo(
        () => pluginFeedback?.getActions() ?? pluginFeedbackVoidActions,
        [pluginFeedback]
    );

    const setMolstarDefaultChain = React.useCallback(() => {
        pdbMolstarActions.sequence.setDefaultChainIfNoIdentifiersAndHasFinishedLoading({
            chainId: chainId,
            ligandId: ligandId,
            chains: chains,
        });
    }, [chainId, chains, ligandId, pdbMolstarActions]);

    React.useEffect(() => {
        pdbMolstarActions.sequence.setDefaultChainOnlyOnInit({
            pdbInfo,
            newSelection,
            chainsRef,
            chains,
        });
    }, [chains, newSelection, pdbInfo, pdbMolstarActions, pdbePlugin]);

    const { pluginRef } = usePluginRef({
        prevSelectionRef,
        pdbePlugin,
        newSelection,
        updateLoader,
        setSelection,
        uploadDataToken,
        extension,
        molstarState,
        setPdbePlugin,
        setPluginLoad,
        proteinId,
        setMolstarDefaultChain,
    });

    debugVariable({ molstarState });
    debugVariable({ pdbePlugin });

    React.useEffect(() => {
        pdbMolstarActions.sequence.retrieveAndSetLigands({
            newSelection,
            onLigandsLoaded,
        });
    }, [onLigandsLoaded, newSelection, pdbMolstarActions.sequence]);

    React.useEffect(
        () =>
            pdbMolstarActions.canvas.applyHighlight({
                chains: chains,
                chainId: chainId,
                ligandId: ligandId,
                molstarState: molstarState,
            }),
        [
            pluginLoad,
            prevSelectionRef,
            chains,
            chainId,
            ligandId,
            pdbePlugin,
            pdbMolstarActions.canvas,
        ]
    );

    // const getRefinedModelUrl = React.useCallback(
    //     (args: RefinedModelGetArgs) => externalModel.getRefinedModelUrl(args),
    //     [externalModel]
    // );

    const checkSelectionChangesWithRefinedModelUrlCheckingAndTriggerChanges = React.useCallback(
        (currentSelection: Selection, newSelection: Selection) => {
            const hasChanges = pdbMolstarActions.selection.hasChanges({
                newSelection: newSelection,
                prevSelection: currentSelection,
            });
            if (!hasChanges) return;

            const onUrlRetrievalFailure = (args: RefinedModelGetArgs) => {
                pluginFeedbackActions.error.whileRetrievingRefinedModelUrl(args);
            };

            const onFetchFailure = (args: RefinedModelGetArgs) => {
                pluginFeedbackActions.error.whileFetchingRefinedModelUrl(args);
            };

            const validSelection =
                newSelection.type === "free"
                    ? externalModel.filterOnlyValidRefinedModels({
                          refinedModels: newSelection.refinedModels,
                          onUrlRetrievalFailure: onUrlRetrievalFailure,
                          onFetchFailure: onFetchFailure,
                      })
                    : Promise.resolve([]);

            validSelection.then(newValidModels => {
                console.debug("Valid models", newValidModels);
                const refinedNewSelection = {
                    ...newSelection,
                    refinedModels: newValidModels,
                };

                /* Refined added/removed/updated are only valid models and when there is a change on them.
            Changes on not valid models will not trigger applySelectionChangesToPlugin() but on setSelection()
            to remove unvalid ones*/

                const hasChanges = pdbMolstarActions.selection.hasChanges({
                    newSelection: refinedNewSelection,
                    prevSelection: currentSelection,
                });

                if (hasChanges && pdbePlugin)
                    updateLoader(
                        "updateVisualPlugin",
                        applySelectionChangesToPlugin(
                            pdbePlugin,
                            molstarState,
                            refinedNewSelection,
                            updateLoader,
                            externalModel.getRefinedModelUrl
                        )
                    );
                setSelection(refinedNewSelection);
            });
        },
        [
            externalModel,
            pdbMolstarActions.selection,
            pdbePlugin,
            pluginFeedbackActions.error,
            setSelection,
            updateLoader,
        ]
    );

    const updatePluginOnNewSelection = React.useCallback(() => {
        if (!pdbePlugin) return _.noop;
        if (loaderBusy) return _.noop;

        const currentSelection = prevSelectionRef.current || emptySelection;

        setPrevSelection(newSelection);

        const uploadDataRemoved =
            currentSelection.type === "uploadData" && newSelection.type !== "uploadData";

        if (uploadDataRemoved) pdbePlugin.visual.remove({});
        if (newSelection.type !== "free") return _.noop;

        const { pdbId, emdbId } = getMainChanges(currentSelection, newSelection);
        if (pdbId) {
            compositionRoot.getRelatedModels.emdbFromPdb(pdbId).run(pdbEmdbId => {
                if (emdbId !== pdbEmdbId || (pdbEmdbId === undefined && emdbId === undefined)) {
                    // Explicitly check for undefined for those models where there is no emdbId
                    checkSelectionChangesWithRefinedModelUrlCheckingAndTriggerChanges(
                        currentSelection,
                        setMainItem(newSelection, pdbEmdbId, "emdb")
                    );
                }
            }, console.error);
        } else if (emdbId && getMainItem(currentSelection, "pdb") === undefined) {
            compositionRoot.getRelatedModels.pdbFromEmdb(emdbId).run(pdbId => {
                checkSelectionChangesWithRefinedModelUrlCheckingAndTriggerChanges(
                    currentSelection,
                    setMainItem(newSelection, pdbId, "pdb")
                );
            }, console.error);
        } else {
            checkSelectionChangesWithRefinedModelUrlCheckingAndTriggerChanges(
                currentSelection,
                newSelection
            );
        }
    }, [
        pdbePlugin,
        loaderBusy,
        prevSelectionRef,
        setPrevSelection,
        newSelection,
        compositionRoot.getRelatedModels,
        checkSelectionChangesWithRefinedModelUrlCheckingAndTriggerChanges,
    ]);

    const updatePluginOnNewSelectionEffect = updatePluginOnNewSelection;
    React.useEffect(updatePluginOnNewSelectionEffect, [updatePluginOnNewSelectionEffect]);

    React.useEffect(() => {
        if (!pdbePlugin) return;
        if (!uploadDataToken) return;
        if (!extension) return;
        pdbePlugin.visual.remove({});
        const supportedExtension = extension === "ent" ? "pdb" : extension;
        const uploadUrl = `${routes.bionotes}/upload/${uploadDataToken}/structure_file.${supportedExtension}`;

        updateLoader(
            loaderKeys.uploadedModel,
            new Promise<void>((resolve, reject) => {
                checkUploadedModelUrl(uploadUrl)
                    .then(res => {
                        if (res.loaded) {
                            pdbePlugin.events.loadComplete.subscribe({
                                next: loaded => {
                                    console.debug("molstar.events.loadComplete", loaded);
                                    if (loaded) resolve();
                                    else reject(loaderErrors.pdbNotLoaded);
                                },
                                error: err => reject(err),
                            });
                            pdbePlugin.load(
                                {
                                    url: uploadUrl,
                                    label: uploadDataToken,
                                    format: extension === "cif" ? "mmcif" : "pdb",
                                    isBinary: false,
                                    assemblyId: "1",
                                },
                                false
                            );
                        } else {
                            reject(loaderErrors.invalidToken);
                            pdbePlugin.canvas.showToast({
                                title: i18n.t("Error"),
                                message: loaderErrors.invalidToken,
                                key: errorsKeys.invalidToken,
                            });
                        }
                    })
                    .catch(_err => {
                        reject(loaderErrors.unexpectedUploadError(uploadUrl));
                        pdbePlugin.canvas.showToast({
                            title: i18n.t("Error"),
                            message: loaderErrors.unexpectedUploadError(uploadUrl),
                            key: errorsKeys.unexpectedUploadError,
                        });
                    });
            })
        );

        // For future reference on this commit: setTitle(i18n.t("Applying..."));
        // hide on promise finished.
    }, [pdbePlugin, uploadDataToken, compositionRoot, extension, updateLoader]);

    function loadFromNetwork() {
        if (!pdbePlugin) return;
        if (!proteinNetwork) return;
        pdbePlugin.visual.remove({});

        const chainInNetwork =
            proteinNetwork.uploadData.chains.find(chain => chain.chain === newSelection.chainId) ||
            _.first(proteinNetwork.uploadData.chains);

        const pdbPath = chainInNetwork?.pdbPath;
        if (!pdbPath) return;

        // For future reference on this commit: setTitle(i18n.t("Applying..."));
        // hide on promise finished.
        pdbePlugin.load(
            {
                url: `${routes.bionotes}/${pdbPath}`,
                label: pdbPath,
                format: "pdb",
                isBinary: false,
                assemblyId: "1",
            },
            false
        );
    }

    React.useEffect(loadFromNetwork, [
        pdbePlugin,
        newSelection.chainId,
        proteinNetwork,
        compositionRoot,
    ]);

    return { pluginRef, pdbePlugin };
}
