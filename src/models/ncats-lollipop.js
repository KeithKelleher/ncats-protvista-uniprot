import {axisLeft, axisBottom, line, scaleLinear, select} from "d3";
import ProtvistaZoomable from "protvista-zoomable";


class NcatsLollipop extends ProtvistaZoomable {
    constructor() {
        super();
    }

    connectedCallback() {
        super.connectedCallback();
        this.setResultObject();
        this.addEventListener("load", e => {
            this.data = e.detail.payload;
        });

        this.addEventListener('change', (e) => {
            if (e.detail?.eventtype == 'click') {
                const selectedResidueStats = e.detail.feature;

                const tooltip = document.getElementById('protvista-uniprot-tooltip');
                if (!tooltip) {
                    return;
                }

                tooltip.title = `Residue ${e.detail.feature?.residue}`;
                tooltip.innerHTML = `Value: ${e.detail.feature.value}`;

                tooltip.visible = true;

                if (e.detail?.coords) {
                    const managerObj = document.getElementById('protvista-manager-obj');
                    const bounds = managerObj.getBoundingClientRect();
                    const [x, y] = e.detail.coords;

                    tooltip.x = x - (window.pageXOffset + bounds.x) + managerObj.offsetLeft;
                    tooltip.y = y - (window.pageYOffset + bounds.y) + managerObj.offsetTop;
                }
            }
        });
    }

    static get observedAttributes() {
        return ProtvistaZoomable.observedAttributes.concat(
            "highlightstart",
            "highlightend",
            "resultObj",
            "height",
            "data"
        );
    }

    setResultObject(obj) {
        if (obj) {
            this.resultObj = obj.length > 0 ? obj[0] : obj;
        } else {
            this.resultObj = JSON.parse(this.getAttribute('resultObj'));
        }
        if (this.resultObj) {
            // this.setAttribute("length", this.resultObj?.values.length);
            if (!super.svg) {
                this._createDataList();
            } else {
                this.refresh();
            }
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (name == 'resultObj') {
            this.setResultObject(newValue);
        }
    }

    get data() {
        return this.resultObj;
    }

    set data(data) {
        console.log('setting data');
        console.log(data);
        if (data && data.hasOwnProperty('values')) {
            this.setResultObject([data]);
        }
        this.setResultObject(data);
    }

    _createDataList() {
        super.svg = select(this)
            .append("div")
            .attr("style", `height: ${this._height}px`)
            .attr("class", "")
            .append("svg")
            .attr("id", "")
            .attr("width", this.width)
            .attr("height", this._height);

        this.data_bg = super.svg.append("g").attr("class", "background");

        this.lollipop_g = super.svg
            .append("g")
            .attr("class", "lollipopgraph")
            .attr("transform", `translate(0,${this.standardOffset()})`);

        this.marginBlock = super.svg.append("rect")
            .attr("height", this._height)
            .attr("width", this.margin.left)
            .attr('fill','white');

        this.x_axis_g = super.svg.append("g").attr("class", "x axis")
            .attr("transform", `translate(${this.margin.left},${this._height - 1})`);

        this.y_axis_g = super.svg.append("g").attr("class", "y axis")
            .attr("transform", `translate(${this.margin.left},-1)`)
            .attr("style", "background-color:white;");

        this.trackHighlighter.appendHighlightTo(this.svg);
        this.refresh();
    }

    standardOffset() {
        return 0.75 * this._height;
    }
    get yMin() {
        if (this.resultObj.max > 0 && this.resultObj.min > 0) {
            return 0;
        }
        return this.resultObj.min;
    }
    get yMax() {
        if (this.resultObj.max < 0 && this.resultObj.min < 0) {
            return 0;
        }
        return this.resultObj.max;
    }
    get yScale() {
        return scaleLinear()
            .domain([0, this.yMax - this.yMin])
            .range([0, this.height]);
    }
    get yScaleFactor() {
        return (this.yMax / (this.yMax - this.yMin));
    }
    get yOffset() {
        return this.height * this.yScaleFactor;
    }

    refresh() {
        if (this.x_axis_g && this.resultObj) {
            const ftWidth = this.getSingleBaseWidth();
            const data = this.resultObj.values.map((s) => {
                return {...s, start: s.residue, end: s.residue};
            });

            this.xAxis = axisBottom(this.xScale).tickValues([]);
            this.x_axis_g.call(this.xAxis);
            this.x_axis_g.select('.domain').attr('transform', `translate(0,${-this.height + this.yOffset})`);

            this.yAxis = axisLeft(this.yScale).tickValues([]);
            this.y_axis_g.call(this.yAxis);
            this.y_axis_g.select(".domain").style("display", "none");

            this.circles = this.data_bg
                .selectAll("circle.circle")
                .data(data, (d) => d.start);

            this.circles
                .enter()
                .append("circle")
                .attr("class", "circle feature")
                .merge(this.circles)
                .attr("cx", (d) => this.getXFromSeqPosition(d.start + 0.5))
                .attr("cy", d => {
                    if (d.value < 0) {
                        return this.yOffset + this.yScale(Math.abs(.8 * d.value));
                    }
                    return this.yOffset - this.yScale(Math.abs(.8 * d.value));
                })
                .attr("r", 5)
                .attr("fill", d => d.color)
                .call(this.bindEvents, this);

            this.circles.exit().remove();

            this.lines = this.data_bg.selectAll('line.stem')
                .data(data, (d) => d.start);
            this.lines.enter().append("line").attr("class", "stem feature").merge(this.lines)
                .attr("x1", (d) => this.getXFromSeqPosition(d.start + 0.5))
                .attr("x2", (d) => this.getXFromSeqPosition(d.start + 0.5))
                .attr("y1", (d) => this.yOffset)
                .attr("y2", (d) => {
                    if (d.value < 0) {
                        return this.yOffset + this.yScale(Math.abs(.8 * d.value));
                    }
                    return this.yOffset - this.yScale(Math.abs(.8 * d.value));
                })
                .attr('stroke', (d) => d.color ? d.color : 'black')
                .call(this.bindEvents, this);
            this.lines.exit().remove();

            this._updateHighlight();
        }
    }

    getXFromSeqPosition(position) {
        return this.margin.left + this.xScale(position);
    }

    _updateHighlight() {
        this.trackHighlighter.updateHighlight();
    }
}

export default NcatsLollipop;