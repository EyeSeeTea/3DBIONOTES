import React from "react";
import _ from "lodash";
import { Pdb } from "../../../domain/entities/Pdb";
import {  PdbView, ProtvistaTrackElement, TrackView } from "./Protvista.types";
import { hasFragments, Track } from "../../../domain/entities/Track";
import { renderToString } from "react-dom/server";
import { Tooltip } from "./Tooltip";

export function loadPdbView(elementRef: React.RefObject<ProtvistaTrackElement>, pdbView: PdbView) {
    const protvistaEl = elementRef.current;
    if (!protvistaEl) return;

    protvistaEl.viewerdata = pdbView;

    if (protvistaEl.layoutHelper && !_.isEmpty(pdbView.tracks)) {
        protvistaEl.layoutHelper.hideSubtracks(0);
    }

    // Collapse first track, which is expanded by default
    protvistaEl.querySelectorAll(`.expanded`).forEach(trackSection => {
        trackSection.classList.remove("expanded");
    });
}

export function getPdbView(pdb: Pdb, options: { trackIds?: string[] } = {}): PdbView {
    const { trackIds } = options;
    const pdbTracks = trackIds
        ? _(pdb.tracks)
              .keyBy(t => t.id)
              .at(...trackIds)
              .compact()
              .value()
        : pdb.tracks;

    return {
        ...pdb,
        displayNavigation: true,
        displaySequence: true,
        displayConservation: false,
        displayVariants: !!pdb.variants,
        tracks: _.compact(
            pdbTracks.map(track => {
                const subtracks = getTrackData(pdb.protein.id, track);
                if (_.isEmpty(subtracks)) return null;
                return {
                    ...track,
                    data: subtracks,
                    help: "getPdbView-TODO",
                };
            })
        ),
        variants: pdb.variants
            ? {
                  ...pdb.variants,
                  variants: pdb.variants.variants.map(variant => ({
                      ...variant,
                      tooltipContent: variant.description,
                  })),
              }
            : undefined,
    };
}

function getTrackData(protein: string, track: Track): TrackView["data"] {
    return _.flatMap(track.subtracks, subtrack =>
        hasFragments(subtrack)
            ? [
                  {
                      ...subtrack,
                      help: "getTrackData-TODO",
                      labelTooltip: subtrack.label,
                      locations: subtrack.locations.map(location => ({
                          ...location,
                          fragments: location.fragments.map(fragment => ({
                              ...fragment,
                              tooltipContent: renderToString(
                                  <Tooltip
                                      protein={protein}
                                      subtrack={subtrack}
                                      fragment={fragment}
                                  />
                              ),
                          })),
                      })),
                  },
              ]
            : []
    );
}
