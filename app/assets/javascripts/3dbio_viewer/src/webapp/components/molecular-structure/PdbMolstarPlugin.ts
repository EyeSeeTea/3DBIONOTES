import _ from "lodash";
import { PDBeMolstarPlugin } from "@3dbionotes/pdbe-molstar/lib";
import { Maybe } from "../../../utils/ts-utils";
import { getDefaultChain, PdbChain, PdbInfo } from "../../../domain/entities/PdbInfo";
import { diffDbItems, getItems, getMainItem, Selection } from "../../view-models/Selection";
import { getLigands } from "./molstar";
import { debugVariable } from "../../../utils/debug";
import { Ligand } from "../../../domain/entities/Ligand";
import { highlight, MolstarStateRef } from "./usePdbPluginHelpers";

export class PdbMolstarPlugin {
    constructor(private pdbePlugin: PDBeMolstarPlugin) {}

    getActions(): PdbMolstarActions {
        return {
            sequence: {
                setDefaultChainIfNoIdentifiersAndHasFinishedLoading: (args: {
                    chainId: Maybe<string>;
                    ligandId: Maybe<string>;
                    chains: PdbChain[];
                }) => this.setDefaultChainInSequenceViewIfNoIdentifiersAndHasFinishedLoading(args),
                setDefaultChainOnlyOnInit: (args: {
                    pdbInfo: Maybe<PdbInfo>;
                    newSelection: Selection;
                    chainsRef: React.MutableRefObject<PdbChain[]>;
                    chains: PdbChain[];
                }) => this.setDefaultChainOnlyOnInitOnSequenceView(args),
                retrieveAndSetLigands: (args: {
                    newSelection: Selection;
                    onLigandsLoaded: (ligands: Ligand[]) => void;
                }) => this.retrieveAndSetLigands(args),
            },
            canvas: {
                applyHighlight: (args: {
                    chains: PdbChain[];
                    chainId: Maybe<string>;
                    ligandId: Maybe<string>;
                    molstarState: MolstarStateRef;
                }) => this.applyHighlight(args),
            },
            selection: {
                hasChanges: (args: { newSelection: Selection; prevSelection: Selection }) =>
                    this.selectionHasChanges(args),
            },
        };
    }

    setDefaultChainInSequenceViewIfNoIdentifiersAndHasFinishedLoading(args: {
        chainId: Maybe<string>;
        ligandId: Maybe<string>;
        chains: PdbChain[];
    }) {
        // Set sequence selected chain
        const { chainId, ligandId, chains } = args;

        if (_.isEmpty(chains)) return; // If no chain, it's impossible to set a default chain

        // chainId and ligandId are undefined only on init
        if (chainId === undefined && ligandId === undefined)
            this.setDefaultChainFromChainsInSequenceView(chains);
    }

    setDefaultChainOnlyOnInitOnSequenceView(args: {
        pdbInfo: Maybe<PdbInfo>;
        newSelection: Selection;
        chainsRef: React.MutableRefObject<PdbChain[]>;
        chains: PdbChain[];
    }) {
        const { pdbInfo, newSelection, chainsRef, chains } = args;
        if (!pdbInfo || pdbInfo.id !== getMainItem(newSelection, "pdb")) return;

        // ChainsRef will only be empty on the first initial render
        if (_.isEmpty(chainsRef.current) && !_.isEmpty(chains)) {
            this.setDefaultChainFromChainsInSequenceView(chains);
            chainsRef.current = chains;
        } else if (!_.isEmpty(chains)) {
            chainsRef.current = chains;
        }
    }

    retrieveAndSetLigands(args: {
        newSelection: Selection;
        onLigandsLoaded: (ligands: Ligand[]) => void;
    }) {
        const { newSelection, onLigandsLoaded } = args;
        const ligands = getLigands(this.pdbePlugin, newSelection) || [];
        debugVariable({ ligands: ligands.length });
        onLigandsLoaded(ligands);
    }

    applyHighlight(args: {
        chains: PdbChain[];
        chainId: Maybe<string>;
        ligandId: Maybe<string>;
        molstarState: MolstarStateRef;
    }) {
        const { chains, chainId, ligandId, molstarState } = args;

        highlight({
            plugin: this.pdbePlugin,
            chains: chains,
            selection: {
                chainId: chainId,
                ligandId: ligandId,
            },
            molstarState: molstarState,
            focus: false,
        });
    }

    selectionHasChanges(args: { newSelection: Selection; prevSelection: Selection }) {
        const { newSelection, prevSelection } = args;
        const oldItems = getItems(prevSelection);
        const newItems = getItems(newSelection);
        const { added, removed, updated } = diffDbItems(oldItems, newItems);

        return !(_.isEmpty(added) && _.isEmpty(removed) && _.isEmpty(updated));
    }

    // To be executed when molstar.events.sequenceComplete
    private setDefaultChainFromChainsInSequenceView(chains: PdbChain[]) {
        const defaultChainId = getDefaultChain(chains);
        /*
             This will propagate back onto the selection state through usePluginRef.setChainThroughMolstar()
            * as pdbe-molstar/index.ts -> this.events.chainUpdate.next(chainId) -> SequenceView <-- this.props.plugin.events.chainUpdate.subscribe
            * and it searches for the numeredId of the dropdown for the defaultChainId, and sets it
            * which will trigger an event through this.setParamProps -> "entity" -> this.updateChainInViewer -> which will call
            * props.onChainUpdate and that is usePluginRef().setChainThroughMolstar on the viewer
            */
        if (defaultChainId) this.setSequenceViewChain(defaultChainId.chainId);
    }

    private setSequenceViewChain(chainId: string) {
        this.pdbePlugin.visual.updateChain(chainId);
    }
}

type PdbMolstarActions = {
    sequence: {
        setDefaultChainIfNoIdentifiersAndHasFinishedLoading: (args: {
            chainId: Maybe<string>;
            ligandId: Maybe<string>;
            chains: PdbChain[];
        }) => void;
        setDefaultChainOnlyOnInit: (args: {
            pdbInfo: Maybe<PdbInfo>;
            newSelection: Selection;
            chainsRef: React.MutableRefObject<PdbChain[]>;
            chains: PdbChain[];
        }) => void;
        retrieveAndSetLigands: (args: {
            newSelection: Selection;
            onLigandsLoaded: (ligands: Ligand[]) => void;
        }) => void;
    };
    canvas: {
        applyHighlight: (args: {
            chains: PdbChain[];
            chainId: Maybe<string>;
            ligandId: Maybe<string>;
            molstarState: MolstarStateRef;
        }) => void;
    };
    selection: {
        hasChanges: (args: { newSelection: Selection; prevSelection: Selection }) => boolean;
    };
};

export const pdbMolstarVoidActions: PdbMolstarActions = {
    sequence: {
        setDefaultChainIfNoIdentifiersAndHasFinishedLoading: _.noop,
        setDefaultChainOnlyOnInit: _.noop,
        retrieveAndSetLigands: _.noop,
    },
    canvas: {
        applyHighlight: _.noop,
    },
    selection: {
        //to outside
        hasChanges: () => false,
    },
};
