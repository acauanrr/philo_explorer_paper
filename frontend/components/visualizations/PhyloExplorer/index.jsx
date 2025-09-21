import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { forceSimulation } from "d3-force";
import { drag } from "d3-drag";
import { zoom } from "d3-zoom";
import { Flex, HStack, Text } from "@chakra-ui/react";
import { parseNewick } from "./libs/parseNewick";
import SidebarContent from "../../layout/Sidebar";
import { usePhyloCtx } from "../../../contexts/PhyloContext";

export default function PhyloExplorer() {
  const { visDataPhylo } = usePhyloCtx();
  const d3Chart = useRef();
  const d3legend = useRef();
  const update = useRef(false);
  const [option, setOption] = useState("1");
  const [isVoronoi, setIsVoronoi] = useState(true);

  // Setup Layout, Branches and Leaves
  const [linkDistance, setLinkDistance] = useState(1);
  const [intLabelNodes, setIntLabelNodes] = useState(false);
  const [leafLabelNodes, setLeafLabelNodes] = useState(true);
  const [raioLeaf, setRaioLeaf] = useState(10);
  const [depthColorGroups, setDepthColorGroups] = useState(2);

  // SVG objects
  var svg, root, link, node, mesh, cell;
  var chartWidth, chartHeight, dimensions;
  var color, legendSVG, legendMenu;
  var simulation, handler, voronoi;

  // ----------------------- CERATE SVG
  function createSVG() {
    const zoomHandler = zoom();
    function zoomFunc(event) {
      svg.attr("transform", event.transform);
    }

    svg = d3
      .select(d3Chart.current)
      .attr("viewBox", dimensions)
      .call(zoomHandler.scaleExtent([0.1, 10]).on("zoom", zoomFunc))
      .on("dblclick.zoom", null)
      .attr("font-family", "sans-serif")
      .attr("font-size", 10)
      .append("g");

    svg.selectAll("*").remove();

    // ---------------------------- Other 2
    function setColor(d) {
      d.color =
        color.domain().indexOf(d) >= 0
          ? color(d)
          : d.parent
          ? d.parent.color
          : "#aaa"; //null
      if (d.children) d.children.forEach(setColor);
    }
    setColor(root);
  }

  function createLegend(colorData) {
    d3.select(d3legend.current).html("");
    legendSVG = d3.select(d3legend.current);

    legendMenu = (legendSVG) => {
      const g = legendSVG
        .selectAll("g")
        .data(colorData)
        .join("g")
        .style("height", "100%")
        .attr("transform", (d, i) => `translate(${0},${0 + i * 20})`);
      g.append("rect").attr("width", 18).attr("height", 18).attr("fill", color);
      g.append("text")
        .attr("x", 24)
        .attr("y", 9)
        .attr("dy", "0.35em")
        .text((d) =>
          color.range().indexOf(d.color) == 0
            ? "Root"
            : `Group ${color.range().indexOf(d.color)}`
        );
    };
    legendSVG.append("g").call(legendMenu);
  }

  function tickedVoronoi() {
    if (isVoronoi) {
      voronoi = d3.Delaunay.from(
        root.leaves(),
        (d) => d.x,
        (d) => d.y
      ).voronoi([
        (-chartWidth / 2) * 2,
        (-chartHeight / 2) * 2,
        chartWidth,
        chartHeight,
      ]);

      cell.attr("d", (d, i) => voronoi.renderCell(i));
      mesh.attr("d", voronoi.render());
    }
  }
  function createVoronoi() {
    mesh = svg
      .append("path")
      .attr("class", "voronoiMesh")
      .attr("fill", "none")
      .attr("d", voronoi.render());

    cell = svg
      .append("g")
      .attr("class", "voronoiCell")
      .attr("pointer-events", "all")
      .selectAll("path")
      .data(root.leaves())
      .join("path")
      .style("fill", (d) => d.color)
      .attr("id", (d, i) => `#cell-${i}`)
      .style("fill-opacity", 0.2)
      .style("stroke", "#fff")
      .style("stroke-width", 0.8)
      .attr("d", (d, i) => voronoi.renderCell(i));
    cell.append("title").text((d) => d.data.name);
  }

  /* ------------------------------------- */
  /* ---------- CREATE LAYOUTS ----------- */
  /* ------------------------------------- */

  // ------------------------------------------------- 1) FORCE LAYOUT
  function createForceLayout() {
    simulation = forceSimulation(root.descendants());
    handler = drag();

    voronoi = d3.Delaunay.from(
      root.leaves(),
      (d) => d.x,
      (d) => d.y
    ).voronoi(dimensions);

    // set up the simulation and event to update locations after each tick
    function initializeSimulation() {
      simulation.nodes(root.descendants());
      initializeForces();
      simulation.on("tick", ticked);
    }

    // add forces to the simulation
    function initializeForces() {
      simulation
        .force(
          "link",
          d3
            .forceLink(root.links())
            .id((d) => d.id)
            .distance(linkDistance)
            .strength(2)
        )
        .velocityDecay(0.1)
        .force("charge", d3.forceManyBody().strength(-50))
        .force("x", d3.forceX())
        .force("y", d3.forceY());
    }

    // generate the svg objects and force simulation
    function initializeDisplay() {
      // Cria Voronoi
      isVoronoi && createVoronoi();

      // Create Force Tree
      link = svg
        .append("g")
        .attr("fill", "none")
        .selectAll("path")
        .data(root.links())
        .join("line")
        .each(function (d) {
          d.target.linkNode = this;
        })
        .attr("stroke", (d) => d.target.color || "#ccc");

      node = svg
        .append("g")
        .selectAll("g.node")
        .data(root.descendants())
        .enter()
        .append("g")
        .call(
          handler
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended)
        );

      node
        .append("circle")
        .attr("class", "nodes")
        .attr("fill", (d) =>
          d.children ? (d.index === 0 ? d.color : null) : d.color
        )
        .attr("r", (d) =>
          d.children ? (d.index === 0 ? raioLeaf : 0) : raioLeaf
        )
        .attr("stroke", "#000")
        .attr("stroke-width", 1);

      node
        .append("text")
        .text((d) =>
          d.children ? (d.index === 0 ? "ROOT" : d.data.name) : d.data.name
        )
        .attr("class", (d) =>
          d.children ? (d.index === 0 ? "ROOT" : "labelInternal") : "labelLeaf"
        )
        .style("cursor", "pointer")
        .style("fill", "#555555")
        .attr("y", 7)
        .attr("x", 0)
        .style("font-size", 5)
        .attr("text-anchor", "middle");

      d3.selectAll(".labelInternal").style("visibility", "hidden");

      // node tooltip
      node
        .append("title")
        .text((d) =>
          d.children ? (d.index === 0 ? "ROOT" : "") : d.data.name
        );

      // Mouse overs
      d3.selectAll("path").on("pointerenter", function () {
        d3.select(this).style("fill-opacity", 0.5);
      });
      d3.selectAll("path").on("pointerleave", function () {
        d3.select(this).style("fill-opacity", 0.2);
      });

      // LEGENDA - Force
      createLegend(color.domain());
    }

    // update the display positions after each simulation tick
    function ticked() {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

      node.attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
      });

      d3.select("#alpha_value").style(
        "flex-basis",
        simulation.alpha() * 100 + "%"
      );
      tickedVoronoi();
    }

    //////////// UI EVENTS ////////////
    var dragstarted = (event, d) => {
      event.sourceEvent.stopPropagation();
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    };

    var dragged = (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
      d.fixed = true;
    };

    var dragended = (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    };

    initializeDisplay();
    initializeSimulation();
  }
  // ------------------------------------------------- 2) VERTICAL LAYOUT
  function createVerticalTreeLayout() {
    //createSVG();
    var horizontalSeparationBetweenNodes = 3000;
    var verticalSeparationBetweenNodes = 128;
    // Tree
    var tree = d3.tree().size([chartWidth, chartHeight]);

    link = svg
      .append("g")
      .selectAll(".link")
      .data(tree(root).links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", (d) => d.target.color || "#ccc")
      .attr(
        "d",
        d3
          .linkVertical()
          .x((d) => d.x)
          .y((d) => d.y)
      );

    node = svg
      .selectAll("g.node")
      .data(root.leaves())
      .enter()
      .append("g")
      .attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
      });

    node
      .append("circle")
      .attr("class", "nodes")
      .attr("fill", (d) =>
        d.children ? (d.index === 0 ? d.color : null) : d.color
      )
      .attr("r", (d) => (d.children ? (d.index === 0 ? 2.5 : 0) : 2.5))
      .attr("stroke", "#000")
      .attr("stroke-width", 1);

    node
      .append("text")
      .text(function (d) {
        return d.data.name;
      })
      .attr("y", 7)
      .attr("x", 0)
      .style("font-size", 5)
      .style("fill", "#555555")
      .attr("text-anchor", "middle")
      .attr("transform", () => "rotate(10)");

    // node tooltip
    node.append("title").text((d) => d.data.name);

    // ---------------------------------- POSICIONAMENTO NA TELA
    svg
      .transition()
      .attr(
        "transform",
        `translate(${-(chartWidth / 2 - 20)}, ${-(chartHeight / 2)})`
      )
      .duration(500);
    tree.size([
      chartWidth + horizontalSeparationBetweenNodes,
      chartHeight + verticalSeparationBetweenNodes,
    ]);

    tree.separation(function (a, b) {
      return a.parent == b.parent ? 1 : 1.25;
    });
    link
      .data(tree(root).links())
      .transition()
      .attr(
        "d",
        d3
          .linkVertical()
          .x(function (d) {
            return d.x;
          })
          .y(function (d) {
            return d.y;
          })
      )
      .duration(500);

    node
      .transition()
      .attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
      })
      .duration(500);

    // LEGENDA - Vertical
    createLegend(color.domain());
  }
  // ------------------------------------------------- 3) HORIZONTAL LAYOUT
  function createHorizontalTreeLayout() {
    //createSVG();
    var horizontalSeparationBetweenNodes = 54;
    var verticalSeparationBetweenNodes = 128;

    // Tree
    var tree = d3.tree().size([chartWidth, chartHeight]);

    link = svg
      .append("g")
      .selectAll(".link")
      .data(tree(root).links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", (d) => d.target.color || "#ccc")
      .attr(
        "d",
        d3
          .linkVertical()
          .x(function (d) {
            return d.x;
          })
          .y(function (d) {
            return d.y;
          })
      );

    node = svg
      .selectAll("g.node")
      .data(root.leaves())
      .enter()
      .append("g")
      .attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
      });

    node
      .append("circle")
      .attr("class", "nodes")
      .attr("fill", (d) =>
        d.children ? (d.index === 0 ? d.color : null) : d.color
      )
      .attr("r", (d) => (d.children ? (d.index === 0 ? 2.5 : 0) : 2.5))
      .attr("stroke", "#000")
      .attr("stroke-width", 1);

    node
      .append("text")
      .text((d) => d.data.name)
      .attr("y", 0)
      .attr("x", (d) => d.data.name.length + d.data.name.length / 2)
      .style("font-size", 5)
      .style("fill", "#555555")
      .attr("text-anchor", "middle");

    // node tooltip
    node.append("title").text((d) => d.data.name);

    // ---------------------------------- TRANSFORM
    svg
      .transition()
      .attr(
        "transform",
        `translate(${-(chartWidth / 2) + 20}, ${-(chartHeight / 2) - 70})`
      )
      .duration(500);
    tree.size([
      chartWidth + horizontalSeparationBetweenNodes,
      chartHeight + verticalSeparationBetweenNodes,
    ]);

    tree.separation(function (a, b) {
      return a.parent == b.parent ? 1 : 1.25;
    });
    link
      .data(tree(root).links())
      .transition()
      .attr(
        "d",
        d3
          .linkHorizontal()
          .x(function (d) {
            return d.y;
          })
          .y(function (d) {
            return d.x;
          })
      )
      .duration(500);

    node
      .transition()
      .attr("transform", function (d) {
        return "translate(" + d.y + "," + d.x + ")";
      })
      .duration(500);

    // LEGENDA - Horizontal
    createLegend(color.domain());
  }

  /* ------------------------------------- */
  /* --------- START APPLICATION --------- */
  /* ------------------------------------- */
  useEffect(() => {
    var dataNewick = parseNewick(visDataPhylo);
    root = d3
      .hierarchy(dataNewick, (d) => d.branchset)
      .sum((d) => (d.branchset ? 0 : 1))
      .sort(
        (a, b) =>
          a.value - b.value || d3.ascending(a.data.length, b.data.length)
      );

    console.log(root);

    if (update.current) {
      d3.select(d3Chart.current).selectAll("g").remove();
    } else {
      update.current = true;
    }
    // Setup ViewBox ----- Dimensions
    chartWidth = +d3.select("#d3demo").style("width").slice(0, -2);
    chartHeight = d3.select("#d3demo").style("height").slice(0, -2);

    dimensions = [-chartWidth / 2, -chartWidth / 2, chartWidth, chartHeight];

    var rangeNodes = root
      .descendants()
      .filter((d) => d.depth <= depthColorGroups);
    console.log(rangeNodes);

    // SETUP COLORR
    color = d3
      .scaleOrdinal()
      .domain(rangeNodes) // .domain(root.children)
      .range([
        "#ff0000",
        "#990066",
        "#54478c",
        "#ff6600",
        "#065143",
        "#0db39e",
        "#147df5",
        "#669900",
        "#16db93",
        "#352208",
        "#2c699a",
        "#5C6D70",
        "#91972A",
        "#ff8700",
        "#ffd300",
        "#3399cc",
        "#a1ff0a",
        "#0aefff",
        "#580aff",
        "#be0aff",
        "#4d86a5",
        "#12e2f1",
        "#3e517a",
        "#98da1f",
        "#fc9f5b",
        "#c3c4e9",
        "#9cc76d",
        "#3185fc",
        "#ffba08",
        "#cbff8c",
        "#8fe388",
        "#1b998b",
        "#2dffdf",
        "#46237a",
        "#ff7b9c",
        "#ff9b85",
      ]);

    // Cria SVG
    createSVG();

    // =============================================== MENU layout
    switch (option) {
      case "1":
        createForceLayout();
        break;
      case "2":
        createVerticalTreeLayout();
        break;
      case "3":
        createHorizontalTreeLayout();
        break;
      default:
        <Text>No visualizations</Text>;
        break;
    }
  }, [option, linkDistance, visDataPhylo, depthColorGroups]);

  /* ------------------------------------ */
  /* ------- FUNCTIONS SIDE MENU -------- */
  /* ------------------------------------ */
  function handleVoronoi() {
    if (!isVoronoi) {
      d3.selectAll(".voronoiMesh,.voronoiCell").style("visibility", "hidden");
    } else {
      d3.selectAll(".voronoiMesh,.voronoiCell").style("visibility", "visible");
    }
  }
  function handleLabelIntNodes() {
    if (intLabelNodes) {
      d3.selectAll(".labelInternal").style("visibility", "visible");
    } else {
      d3.selectAll(".labelInternal").style("visibility", "hidden");
    }
  }
  function handleLabelLeafNodes() {
    if (leafLabelNodes) {
      d3.selectAll(".labelLeaf").style("visibility", "visible");
    } else {
      d3.selectAll(".labelLeaf").style("visibility", "hidden");
    }
  }
  function changeRaioLeaf() {
    d3.selectAll(".nodes").attr("r", (d) =>
      d.children ? (d.index === 0 ? raioLeaf : 0) : raioLeaf
    );
  }
  useEffect(() => {
    handleVoronoi();
    handleLabelIntNodes();
    handleLabelLeafNodes();
    changeRaioLeaf();
  }, [isVoronoi, intLabelNodes, leafLabelNodes, raioLeaf]);

  return (
    <HStack w="full" h="full" spacing={0} overflow="hidden">
      <SidebarContent
        option={option}
        setOption={setOption}
        isVoronoi={isVoronoi}
        setIsVoronoi={setIsVoronoi}
        linkDistance={linkDistance}
        setLinkDistance={setLinkDistance}
        intLabelNodes={intLabelNodes}
        setIntLabelNodes={setIntLabelNodes}
        leafLabelNodes={leafLabelNodes}
        setLeafLabelNodes={setLeafLabelNodes}
        raioLeaf={raioLeaf}
        setRaioLeaf={setRaioLeaf}
        depthColorGroups={depthColorGroups}
        setDepthColorGroups={setDepthColorGroups}
      />

      <Flex
        id="d3demo"
        flex="1"
        height="100%"
        _hover={{ cursor: "pointer" }}
        position="relative"
        overflow="hidden"
      >
        <Flex
          position="absolute"
          width="20"
          height="full"
          left="0px"
          top="0px"
          fontSize="xs"
          zIndex={10}
        >
          <svg ref={d3legend}></svg>
        </Flex>
        <svg ref={d3Chart} style={{ width: "100%", height: "100%" }}></svg>
      </Flex>
    </HStack>
  );
}