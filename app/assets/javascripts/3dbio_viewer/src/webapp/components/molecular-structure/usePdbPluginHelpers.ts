import _ from "lodash";
import React from "react";
import { InitParams } from "@3dbionotes/pdbe-molstar/lib/spec";
import { PDBeMolstarPlugin } from "@3dbionotes/pdbe-molstar/lib";
import { LoadParams } from "@3dbionotes/pdbe-molstar/lib/helpers";
import {
    BaseSelection,
    DbItem,
    diffDbItems,
    getItems,
    getItemSelector,
    getMainItem,
    getRefinedModelIds,
    MainType,
    Selection,
    Type,
} from "../../view-models/Selection";
import {
    refinedModelArgsToString,
    RefinedModelGetArgs,
} from "../../../domain/repositories/RefinedModelRepository";
import { getCurrentItems, loadEmdb, setEmdbOpacity } from "./molstar";
import { PdbInfo } from "../../../domain/entities/PdbInfo";
import { Maybe } from "../../../utils/ts-utils";
import { getSelectedChain } from "../viewer-selector/ViewerSelector";
import { MolecularStructureProps } from "./MolecularStructure";
import { MolstarState, MolstarStateActions } from "./MolstarState";
import { RefinedModelType } from "../../../domain/entities/RefinedModel";
import i18n from "../../../domain/utils/i18n";
import "./molstar.css";
import "./molstar-light.css";

export const urls: Record<MainType, (id: string) => string> = {
    pdb: (id: string) => `https://www.ebi.ac.uk/pdbe/model-server/v1/${id}/full?encoding=cif`,
    emdb: (id: string) => `https://maps.rcsb.org/em/${id}/cell?detail=3`,
};

export const loaderErrors = {
    pdbNotLoaded: i18n.t("PDB molstar did not load"),
    invalidToken: i18n.t("Invalid token and/or type"),
    tokenNotFound: i18n.t("No token found"),
    undefinedPdb: i18n.t("PDB is not defined"),
    pdbNotMatching: i18n.t("No PDB found for this EMDB model"),
    invalidExtension: i18n.t('The extension must be "pdb", "ent", "cif"'),
    unexpectedUploadError: (url: string) =>
        i18n.t(`Unkown error while loading the model URL: ${url}`),
    modelNotFound: (pdbId: string) => i18n.t(`${pdbId} was not found`),
    serviceUnavailable: (pdbId: string) => i18n.t(`Unable to load ${pdbId}. Service unavailable`),
    pdbRequest: (url: string, status: number) =>
        i18n.t(`Error loading PDB model: url=${url} - ${status}`),
    request: (url: string, status: number) => i18n.t(`Error loading model: url=${url} - ${status}`),
    refinedModelUnableToFindModelUrl: (args: RefinedModelGetArgs) =>
        i18n.t("Unable to find refined model URL: {{args}}", {
            args: refinedModelArgsToString(args),
        }),
    refinedModelUnableToFetch: (args: RefinedModelGetArgs) =>
        i18n.t("Unable to fetch refined model URL: {{args}}", {
            args: refinedModelArgsToString(args),
        }),
};

export const errorsKeys = _.mapValues(loaderErrors, (_v, k) => k);

export function setVisibility(plugin: PDBeMolstarPlugin, item: DbItem) {
    const selector = getItemSelector(item);
    return plugin.visual.setVisibility(selector, item.visible || false);
}

export async function highlight(args: {
    plugin: PDBeMolstarPlugin;
    chains: Maybe<PdbInfo["chains"]>;
    selection: BaseSelection;
    molstarState: MolstarStateRef;
    focus: Maybe<boolean>;
}): Promise<void> {
    const { plugin, chains, selection, molstarState, focus = true } = args;
    plugin.visual.clearSelection().catch(_err => {});
    plugin.visual.clearHighlight().catch(_err => {}); //remove previous highlight
    const ligandsView = getLigandView(selection);
    if (ligandsView) return;

    const chainId = selection.chainId;
    const chain = getSelectedChain(chains, chainId);
    molstarState.current = MolstarStateActions.setChain(molstarState.current, chainId);

    if (!chain) return;

    try {
        await plugin.visual.select({
            data: [
                {
                    auth_asym_id: chain.chainId,
                    color: "#0000ff",
                    focus,
                },
            ],
            structureNumber: 1, //rooting to the main PDB
            nonSelectedColor: { r: 255, g: 255, b: 255 },
        });
    } catch (err: any) {
        console.error("highlight", err);
    }
}

type LigandView = InitParams["ligandView"];

export function getLigandView(selection: BaseSelection): LigandView | undefined {
    const { chainId, ligandId } = selection;
    if (!chainId || !ligandId) return;
    const [component, position] = ligandId.split("-");
    if (!component || !position) return;

    return {
        auth_asym_id: chainId, //+_1 on previous versions
        auth_seq_id: parseInt(position),
        label_comp_id: component,
    };
}

export type MolstarStateRef = React.MutableRefObject<MolstarState>;

export async function applySelectionChangesToPlugin(
    plugin: PDBeMolstarPlugin,
    molstarState: MolstarStateRef,
    newSelection: Selection,
    updateLoader: MolecularStructureProps["updateLoader"],
    getRefinedModelUrl: (args: RefinedModelGetArgs) => Promise<string>
): Promise<void> {
    if (molstarState.current.type !== "pdb") return;

    const oldItems = () => (molstarState.current.type === "pdb" ? molstarState.current.items : []);
    const updateItems = (item: DbItem) => {
        molstarState.current = MolstarStateActions.updateItems(
            molstarState.current,
            _.unionBy(oldItems(), [item], getId)
        );
    };

    const getTitle = (idx: number, items: DbItem[], modelType: Type) => {
        return items.length > 1
            ? i18n.t(`Loading ${modelType.toUpperCase()} (${idx + 1}/${items.length})...`)
            : i18n.t(`Loading ${modelType.toUpperCase()}...`);
    };

    const loadRefinedItems = async (items: DbItem<RefinedModelType>[]) => {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item) {
                const { pdbId, emdbId } = getRefinedModelIds(item);
                const args = {
                    pdbId: pdbId,
                    emdbId: emdbId,
                    method: item.type,
                };

                const filenameUrl = await getRefinedModelUrl(args).catch(err => {
                    plugin.canvas.showToast({
                        title: i18n.t("Error"),
                        message: loaderErrors.refinedModelUnableToFindModelUrl(args),
                        key: errorsKeys.refinedModelUnableToFindModelUrl,
                    });
                    return Promise.reject(err);
                });
                await checkModelUrl({ id: item.id, url: filenameUrl }).then(async res => {
                    if (res.loaded) {
                        const loadParams: LoadParams = {
                            url: filenameUrl,
                            label: item.id,
                            format: filenameUrl.endsWith(".pdb") ? "pdb" : "mmcif",
                            isBinary: false,
                            assemblyId: "1",
                        };
                        await updateLoader(
                            "loadModel",
                            plugin.load(loadParams, false),
                            getTitle(i, items, item.type)
                        );
                        setVisibility(plugin, item);
                        updateItems(item);
                    } else
                        plugin.canvas.showToast({
                            title: i18n.t("Error"),
                            message: getErrorByStatus(item.id, res.status),
                            key: errorKeyByStatus(res.status),
                        });
                });
            }
        }
    };

    const newItems = getItems(newSelection);

    const { added, removed, updated } = diffDbItems(newItems, oldItems());

    const pdbs = added.filter(item => item.type === "pdb");
    const emdbs = added.filter(item => item.type === "emdb");
    const pdbRedo = added.filter(item => item.type === "pdbRedo");
    const isolde = added.filter(item => item.type === "isolde");
    const refmac = added.filter(item => item.type === "refmac");
    const phenix = added.filter(item => item.type === "phenix");

    const mainPdb = newItems.find(item => item.type === "pdb");
    const mainEmdb = newItems.find(item => item.type === "emdb");
    if (mainPdb) setVisibility(plugin, mainPdb);
    if (mainEmdb) {
        setVisibility(plugin, mainEmdb);
        if (mainEmdb.visible) setEmdbOpacity({ plugin, id: mainEmdb.id, value: 0.5 });
    }

    console.debug(
        "Update molstar:",
        _({ oldItems: oldItems(), added, removed, updated })
            .mapValues(objs => objs.map(obj => obj.id).join(", "))
            .pickBy()
            .value()
    );

    if (added.length + removed.length) {
        plugin.canvas.hideToasts();
    }

    for (const item of removed) {
        plugin.visual.remove(getItemSelector(item));
        molstarState.current = MolstarStateActions.updateItems(
            molstarState.current,
            _.differenceBy(oldItems(), [item], getId)
        );
    }

    for (const item of updated) {
        setVisibility(plugin, item);
        molstarState.current = MolstarStateActions.updateItems(
            molstarState.current,
            oldItems().map(item_ => (item_.id === item.id ? item : item_))
        );
    }

    for (let i = 0; i < pdbs.length; i++) {
        const item = pdbs[i];
        if (item) {
            const pdbId = item.id;
            const url = urls.pdb(pdbId);
            await checkModelUrl({ id: pdbId, url }).then(async res => {
                if (res.loaded) {
                    const loadParams: LoadParams = {
                        url,
                        label: pdbId,
                        format: "mmcif",
                        isBinary: false,
                        assemblyId: "1",
                    };
                    await updateLoader(
                        "loadModel",
                        plugin.load(loadParams, false),
                        pdbs.length > 1
                            ? i18n.t(`Loading PDB (${i + 1}/${pdbs.length})...`)
                            : i18n.t("Loading PDB...")
                    );
                    setVisibility(plugin, item);
                    updateItems(item);
                } else if (getMainItem(newSelection, "pdb") === pdbId)
                    updateLoader("loadModel", Promise.reject(getErrorByStatus(pdbId, res.status)));
                if (!res.loaded)
                    plugin.canvas.showToast({
                        title: i18n.t("Error"),
                        message: getErrorByStatus(pdbId, res.status),
                        key: errorKeyByStatus(res.status),
                    });
            });
        }
    }

    const items = getCurrentItems(plugin);

    for (let i = 0; i < emdbs.length; i++) {
        const item = emdbs[i];
        if (item) {
            const emdbId = item.id;
            if (items.some(item => item.type === "emdb" && item.id === emdbId)) continue;
            const url = urls.emdb(emdbId);
            await checkModelUrl({ id: emdbId, url }).then(async res => {
                if (res.loaded) {
                    await updateLoader(
                        "loadModel",
                        loadEmdb(plugin, url),
                        emdbs.length > 1
                            ? i18n.t(`Loading EMDB (${i + 1}/${emdbs.length})...`)
                            : i18n.t("Loading EMDB...")
                    );
                    setEmdbOpacity({ plugin, id: item.id, value: 0.5 });
                    setVisibility(plugin, item);
                    updateItems(item);
                } else
                    plugin.canvas.showToast({
                        title: i18n.t("Error"),
                        message: getErrorByStatus(emdbId, res.status),
                        key: errorKeyByStatus(res.status),
                    });
            });
        }
    }

    ([pdbRedo, isolde, refmac, phenix] as DbItem<RefinedModelType>[][]).forEach(items =>
        loadRefinedItems(items)
    );

    // Remove unused elements
    const itemsAfterUpdate = getCurrentItems(plugin);
    const selectionIds = newItems.map(getId);
    const danglingItems = itemsAfterUpdate.filter(item => !selectionIds.includes(item.id));

    for (const item of danglingItems) {
        plugin.visual.remove(getItemSelector(item));
        molstarState.current = MolstarStateActions.updateItems(
            molstarState.current,
            _.differenceBy(oldItems(), [item], getId)
        );
    }

    if (added.length + removed.length) {
        plugin.visual.reset({ camera: true });
    }
}

export async function checkModelUrl(args: { id: Maybe<string>; url: string }): Promise<Response> {
    const { id, url } = args;
    if (!id) return { loaded: true, status: 404 };

    //method HEAD makes 404 be 200 anyways
    return await fetch(url, { method: "GET", cache: "force-cache" })
        .then(res => {
            console.debug("Checking model: " + id, res.status);
            return res.ok
                ? { loaded: true, status: res.status }
                : { loaded: false, status: res.status };
        })
        .catch(res => {
            const msg = loaderErrors.pdbRequest(url, res.status);
            console.error(msg);
            return { loaded: false, status: res.status };
        }); //we are only caching if url exist
}

export async function checkMainModelUrl(
    id: string,
    type: MainType
): Promise<{ loaded: boolean; status: number }> {
    return checkModelUrl({ id, url: urls[type](id) });
}

export async function checkUploadedModelUrl(url: string): Promise<Response> {
    return fetch(url, { method: "GET", cache: "force-cache" }).then(res => {
        if (res.ok && res.status != 404 && res.status != 500 && res.status != 503)
            return { loaded: true, status: res.status };
        else {
            const msg = loaderErrors.request(url, res.status);
            console.error(msg);
            return { loaded: false, status: res.status };
        }
    });
}

export function getErrorByStatus(id: string, status: number) {
    switch (status) {
        case 404:
            return loaderErrors.modelNotFound(id);
        case 500:
            return loaderErrors.serviceUnavailable(id);
        case 503:
            return loaderErrors.serviceUnavailable(id);
        default:
            return loaderErrors.modelNotFound(id);
    }
}

export function errorKeyByStatus(status: number) {
    switch (status) {
        case 404:
            return errorsKeys.modelNotFound;
        case 500:
            return errorsKeys.serviceUnavailable;
        case 503:
            return errorsKeys.serviceUnavailable;
        default:
            return errorsKeys.modelNotFound;
    }
}

function getId<T extends { id: string }>(obj: T): string {
    return obj.id;
}

type Response = { loaded: boolean; status: number };
