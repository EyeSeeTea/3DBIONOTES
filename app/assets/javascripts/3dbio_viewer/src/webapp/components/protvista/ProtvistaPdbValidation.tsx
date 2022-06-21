import React from "react";
import * as d3Module from "d3";
import { ProtvistaPdb, ProtvistaPdbProps } from "./ProtvistaPdb";

declare global {
    const d3: typeof d3Module;
}
const data = [
    {
        name: "foo",
        units: 32,
    },
    {
        name: "bar",
        units: 67,
    },
    {
        name: "baz",
        units: 81,
    },
    {
        name: "hoge",
        units: 38,
    },
    {
        name: "plyo",
        units: 28,
    },
    {
        name: "hogera",
        units: 59,
    },
];

const dimensions = {
    width: 450,
    height: 300,
};

export const ProtvistaPdbValidation: React.FC<ProtvistaPdbProps> = React.memo(props => {
    const [ref] = useBarChart();

    return (
        <>
            <h2>This is the custom ProtvistaPdbValidation component</h2>
            <svg ref={ref} width={dimensions.width} height={dimensions.height} />
            <ProtvistaPdb {...props} />
        </>
    );
});

function useBarChart() {
    const svgRef = React.useRef<SVGSVGElement>(null);

    const [selection, setSelection] = React.useState<null | d3Module.Selection<
        SVGSVGElement,
        unknown,
        null,
        undefined
    >>(null);

    React.useEffect(() => {
        drawGraph();
    });

    const drawGraph = () => {
        const x = d3
            .scaleBand()
            .domain(data.map(d => d.name))
            .range([0, dimensions.width])
            .paddingInner(0.05);

        const y = d3
            .scaleLinear()
            .domain([0, d3.max(data, d => d.units) || 0])
            .range([dimensions.height, 0]);

        if (!svgRef.current) {
            return;
        } else if (!selection) {
            setSelection(d3.select(svgRef.current));
        } else {
            selection
                .selectAll("rect")
                .data(data)
                .enter()
                .append("rect")
                .attr("width", x.bandwidth)
                .attr("height", d => dimensions.height - y(d.units))
                .attr("x", d => x(d.name) || "")
                .attr("y", d => y(d.units))
                .attr("fill", "blue");
        }
    };
    return [svgRef];
}
