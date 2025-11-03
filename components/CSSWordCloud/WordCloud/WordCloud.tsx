/** @format */

import { useEffect } from "react";
// import d3
import d3Cloud from "d3-cloud";
import * as d3 from "d3";
import "./WordCloud.css";
// const as = d3Cloud_ as any;
// include namespace for d3-cloud
// import { d3 } from 'd3-cloud';

const loremIpsum = `Lorem ipsum
`;

// Get the words from the text
const loremWords = loremIpsum.split(" ").map((word) => {
  return word;
});
export const WordCloud = ({ words = loremWords }: { words: string[] }) => {
  useEffect(() => {
    function draw(words: Array<String>) {
      d3.select("#cloud")
        .append("svg")
        .attr("width", layout.size()[0])
        .attr("height", layout.size()[1])
        .append("g")
        .attr(
          "transform",
          "translate(" + layout.size()[0] / 2 + "," + layout.size()[1] / 2 + ")"
        )
        .selectAll("text")
        .data(words)
        .enter()
        .append("text")
        .style("font-size", function (d: any) {
          return d.size + "px";
        })
        .style("font-family", "Impact")
        .attr("text-anchor", "middle")
        .attr("transform", function (d: any) {
          return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
        })
        .text(function (d: any) {
          return d.text;
        });
    }
    // create a d3 cloud layout
    const layout = d3Cloud()
      .size([1500, 800])
      .words(
        words.map(function (d: string) {
          return { text: d, size: 15 + Math.random() * 30, test: "haha" };
        })
      )
      .padding(0)
      .rotate(function () {
        return ~~(Math.random() * 2) * 90;
      })
      .font("Impact")
      .fontSize(function (d: any) {
        return d.size;
      })
      .on("end", draw);
    // Set willReadFreguently to true

    // Change text color to black

    layout.start();
  }, []);

  return <div id="cloud" />;
};
