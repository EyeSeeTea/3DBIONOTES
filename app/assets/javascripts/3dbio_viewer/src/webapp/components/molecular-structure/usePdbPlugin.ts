import React from "react";
import _ from "lodash";
import { PDBeMolstarPlugin } from "@3dbionotes/pdbe-molstar/lib";
import {
    diffDbItems,
    emptySelection,
    getItems,
    getMainChanges,
    getMainItem,
    getRefinedModelIds,
    Selection,
    setMainItem,
} from "../../view-models/Selection";
import { RefinedModelGetArgs } from "../../../domain/repositories/RefinedModelRepository";
import { debugVariable } from "../../../utils/debug";
import { useReference } from "../../hooks/use-reference";
import { useAppContext } from "../AppContext";
import { getLigands } from "./molstar";
import { getDefaultChain, PdbInfo } from "../../../domain/entities/PdbInfo";
import { routes } from "../../../routes";
import { MolecularStructureProps } from "./MolecularStructure";
import { MolstarState } from "./MolstarState";
import { loaderKeys } from "../RootViewerContents";
import { usePluginRef } from "./usePluginRef";
import i18n from "../../utils/i18n";
import "./molstar.css";
import "./molstar-light.css";
import {
    applySelectionChangesToPlugin,
    checkModelUrl,
    checkUploadedModelUrl,
    errorKeyByStatus,
    errorsKeys,
    getErrorByStatus,
    highlight,
    loaderErrors,
} from "./usePdbPluginHelpers";

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

    const chains = React.useMemo(() => pdbInfo?.chains ?? [], [pdbInfo?.chains]);
    const chainsRef = React.useRef<PdbInfo["chains"]>([]);

    // Keep a reference containing the previous value of selection. We need this value to diff
    // the new state against the old state and perform imperative operations (add/remove/update)
    // on the plugin.
    const [prevSelectionRef, setPrevSelection] = useReference<Selection>();
    const [uploadDataToken, extension] =
        newSelection.type === "uploadData" ? [newSelection.token, newSelection.extension] : [];

    const setMolstarDefaultChain = React.useCallback(() => {
        if (!pdbePlugin || _.isEmpty(chains)) return;
        if (chainId === undefined && ligandId === undefined) {
            const defaultChainId = getDefaultChain(chains);
            // This will propagate back onto the selection state through usePluginRef.setChainThroughMolstar()
            if (defaultChainId) pdbePlugin.visual.updateChain(defaultChainId.chainId);
        }
    }, [chainId, chains, ligandId, pdbePlugin]);

    const setDefaultChainOnlyOnlyOnInitEffect = () => {
        if (!pdbePlugin || !pdbInfo || pdbInfo.id !== getMainItem(newSelection, "pdb")) return;

        // ChainsRef will only be empty on the first initial render
        if (_.isEmpty(chainsRef.current) && !_.isEmpty(chains) && pdbePlugin) {
            const defaultChainId = getDefaultChain(chains);
            if (defaultChainId) pdbePlugin.visual.updateChain(defaultChainId.chainId);
            chainsRef.current = chains;
        } else if (!_.isEmpty(chains)) {
            chainsRef.current = chains;
        }
    };

    React.useEffect(setDefaultChainOnlyOnlyOnInitEffect, [
        chains,
        newSelection,
        pdbInfo,
        pdbePlugin,
    ]);

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

    function setLigandsFromMolstar() {
        if (!pluginLoad || !pdbePlugin) return;
        const ligands = getLigands(pdbePlugin, newSelection) || [];
        debugVariable({ ligands: ligands.length });
        onLigandsLoaded(ligands);
    }

    function applyHighlight() {
        if (!pluginLoad || !pdbePlugin) return;
        highlight(pdbePlugin, chains, { chainId, ligandId }, molstarState, false);
    }

    React.useEffect(setLigandsFromMolstar, [pluginLoad, pdbePlugin, onLigandsLoaded, newSelection]);
    React.useEffect(applyHighlight, [
        pluginLoad,
        prevSelectionRef,
        chains,
        chainId,
        ligandId,
        pdbePlugin,
    ]);

    const getRefinedModelUrl = React.useCallback(
        (args: RefinedModelGetArgs): Promise<string> => {
            return compositionRoot.getRefinedModel
                .execute(args)
                .map(refinedModel => refinedModel.filenameUrl)
                .toPromise();
        },
        [compositionRoot]
    );

    const updateSelection = React.useCallback(
        (currentSelection: Selection, newSelection: Selection) => {
            if (!pdbePlugin) return;
            const oldItems = getItems(currentSelection);
            const newItems = getItems(newSelection);
            const { added, removed, updated } = diffDbItems(oldItems, newItems);
            if (_.isEmpty(added) && _.isEmpty(removed) && _.isEmpty(updated)) return;

            const validSelection =
                newSelection.type === "free"
                    ? Promise.all(
                          newSelection.refinedModels.map(async model => {
                              const { pdbId, emdbId } = getRefinedModelIds(model);
                              const args = {
                                  pdbId: pdbId,
                                  emdbId: emdbId,
                                  method: model.type,
                              };
                              const filenameUrl = await getRefinedModelUrl(args).catch(err => {
                                  pdbePlugin.canvas.showToast({
                                      title: i18n.t("Error"),
                                      message: loaderErrors.refinedModelUnexpectedError(args),
                                      key: errorsKeys.refinedModelUnexpectedError,
                                  });
                                  return Promise.reject(err);
                              });
                              return await checkModelUrl({
                                  id: pdbId,
                                  url: filenameUrl,
                              }).then(res => {
                                  if (res.loaded) return model;
                                  else {
                                      pdbePlugin.canvas.showToast({
                                          title: i18n.t("Error"),
                                          message: getErrorByStatus(model.id, res.status),
                                          key: errorKeyByStatus(res.status),
                                      });
                                      return undefined;
                                  }
                              });
                          })
                      ).then(models => _.compact(models))
                    : Promise.resolve([]);

            validSelection.then(newValidModels => {
                console.debug("Valid models", newValidModels);
                const refinedNewSelection = {
                    ...newSelection,
                    refinedModels: newValidModels,
                };
                const newRefinedItems = getItems(refinedNewSelection);
                const {
                    added: refinedAdded,
                    removed: refinedRemoved,
                    updated: refinedUpdated,
                } = diffDbItems(oldItems, newRefinedItems);
                /* Refined added/removed/updated are only valid models and when there is a change on them.
            Changes on not valid models will not trigger applySelectionChangesToPlugin() but on setSelection()
            to remove unvalid ones*/

                const hasChanges = !(
                    _.isEmpty(refinedAdded) &&
                    _.isEmpty(refinedRemoved) &&
                    _.isEmpty(refinedUpdated)
                );

                if (hasChanges)
                    updateLoader(
                        "updateVisualPlugin",
                        applySelectionChangesToPlugin(
                            pdbePlugin,
                            molstarState,
                            refinedNewSelection,
                            updateLoader,
                            getRefinedModelUrl
                        )
                    );
                setSelection(refinedNewSelection);
            });
        },
        [getRefinedModelUrl, pdbePlugin, setSelection, updateLoader]
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
                    updateSelection(currentSelection, setMainItem(newSelection, pdbEmdbId, "emdb"));
                }
            }, console.error);
        } else if (emdbId && getMainItem(currentSelection, "pdb") === undefined) {
            compositionRoot.getRelatedModels.pdbFromEmdb(emdbId).run(pdbId => {
                updateSelection(currentSelection, setMainItem(newSelection, pdbId, "pdb"));
            }, console.error);
        } else {
            updateSelection(currentSelection, newSelection);
        }
    }, [
        pdbePlugin,
        loaderBusy,
        prevSelectionRef,
        setPrevSelection,
        newSelection,
        compositionRoot.getRelatedModels,
        updateSelection,
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
