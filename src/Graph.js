import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { select } from 'd3-selection';
import { scaleLinear, scaleTime } from 'd3-scale';
import { axisLeft, axisBottom } from 'd3-axis';
import { max } from 'd3-array';
import { path } from 'd3-path';
import { format } from 'date-fns';

import styles from './Graph.module.css';

const MARGIN = {
  top: 20,
  right: 20,
  bottom: 20,
  left: 65,
};

const Axis = ({ axis, axisDeps, x = 0, y = 0 }) => {
  const ref = useRef(null);

  useEffect(() => {
    select(ref.current).call(axis);
    // because axis is a single mutable instance, we must pass deps manually
    // the axisDeps array length must never change
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [axis, ...axisDeps]);

  return <g ref={ref} transform={`translate(${x},${y})`} />;
};

Axis.propTypes = {
  axis: PropTypes.func.isRequired,
  axisDeps: PropTypes.array.isRequired,
  x: PropTypes.number,
  y: PropTypes.number,
};

const datumShape = PropTypes.shape({
  date: PropTypes.object.isRequired,
  xJewel: PropTypes.number.isRequired,
  bankJewel: PropTypes.number.isRequired,
  xJewelWallets: PropTypes.number.isRequired,
  circulatingJewel: PropTypes.number.isRequired,
  ratio: PropTypes.number.isRequired,
});

const Tooltip = ({ datum, x, y, opacity }) => {
  const style = useMemo(
    () => ({
      opacity,
      transform: `translate(${x}px,${y}px)`,
    }),
    [x, y, opacity],
  );
  const formatter = useMemo(() => new Intl.NumberFormat('en-US'), []);
  const { date, xJewel, bankJewel, ratio, circulatingJewel } = datum;

  return (
    <div className={styles.tooltip} style={style}>
      <span className={styles.row}>
        <span className={styles.key}>Date:</span>
        <span className={styles.value}>{format(date, 'PPPP')}</span>
      </span>
      <span className={styles.row}>
        <span className={styles.key}>xJewel:</span>
        <span className={styles.value}>{formatter.format(xJewel)}</span>
      </span>
      <span className={styles.row}>
        <span className={styles.key}>xJewel in Jewel:</span>
        <span className={styles.value}>{formatter.format(bankJewel)}</span>
      </span>
      <span className={styles.row}>
        <span className={styles.key}>Bank Ratio:</span>
        <span className={styles.value}>{formatter.format(ratio)}</span>
      </span>
      <span className={styles.row}>
        <span className={styles.key}>Circulating Jewel:</span>
        <span className={styles.value}>
          {formatter.format(circulatingJewel)}
        </span>
      </span>
    </div>
  );
};

Tooltip.propTypes = {
  datum: datumShape.isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
};

const useScale = (scaleFn, domain, range) => {
  const [domainMin, domainMax] = domain;
  const [rangeMin, rangeMax] = range;
  // return scale/axis deps for future computations/renders
  const scaleDeps = [domainMin, domainMax, rangeMin, rangeMax];
  // only instantiate scale once as it's mutable
  const scale = useMemo(
    () => scaleFn().domain(domain).range(range),
    // deliberately ignore domain and range for instantiation
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [scaleFn],
  );
  // update scale
  useEffect(
    () => scale.domain([domainMin, domainMax]).range([rangeMin, rangeMax]),
    [scale, domainMin, domainMax, rangeMin, rangeMax],
  );

  return [scale, scaleDeps];
};

// only instantiate and connect axis and scale once as they're both mutable
const useAxis = (axisFn, scale) =>
  useMemo(() => axisFn(scale), [axisFn, scale]);

const useSVGMousePosition = () => {
  const svgRef = useRef(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);
  const [isTrackingMouseMove, setIsTrackingMouseMove] = useState(false);
  const handleMouseMove = useCallback((e) => {
    requestAnimationFrame(() =>
      setTooltipPosition({
        x: e.clientX,
        y: e.clientY,
        svgX: e.offsetX,
        svgY: e.offsetY,
      }),
    );
  }, []);
  const handleSVGMouseEnter = useCallback(
    () => setIsTrackingMouseMove(true),
    [],
  );
  const handleSVGMouseLeave = useCallback(() => {
    setTooltipPosition(null);
    setIsTrackingMouseMove(false);
  }, []);
  const handleDataPointEnter = useCallback(
    (datum) => setTooltipData(datum),
    [],
  );
  const handleDataPointLeave = useCallback(() => setTooltipData(null), []);

  useEffect(() => {
    if (!isTrackingMouseMove) {
      return;
    }
    const node = svgRef.current;
    node.addEventListener('mousemove', handleMouseMove);
    return () => node.removeEventListener('mousemove', handleMouseMove);
  }, [svgRef, isTrackingMouseMove, handleMouseMove]);

  return {
    svgRef,
    tooltipPosition,
    tooltipData,
    handleSVGMouseEnter,
    handleSVGMouseLeave,
    handleDataPointEnter,
    handleDataPointLeave,
  };
};

const DataPoint = ({ datum, onMouseEnter, onMouseLeave }) => {
  const handleDataPointEnter = useCallback(
    () => onMouseEnter(datum),
    [datum, onMouseEnter],
  );
  const handleDataPointLeave = useCallback(
    () => onMouseLeave(datum),
    [datum, onMouseLeave],
  );

  return (
    <>
      <circle
        className={classNames(styles.dataPoint, styles.circulating)}
        cx={datum.x}
        cy={datum.circulatingY}
        r={4}
        onMouseEnter={handleDataPointEnter}
        onMouseLeave={handleDataPointLeave}
      />
      <circle
        className={classNames(styles.dataPoint, styles.bank)}
        cx={datum.x}
        cy={datum.bankJewelY}
        r={4}
        onMouseEnter={handleDataPointEnter}
        onMouseLeave={handleDataPointLeave}
      />
    </>
  );
};

const Graph = ({ data, width = 1176, height = 640 }) => {
  const transformedData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        bankJewel: d.xJewel * d.ratio,
        date: new Date(d.date),
      })),
    [data],
  );

  const { dateDomain, jewelDomain } = useMemo(() => {
    const maxJewel = max(
      transformedData,
      (d) => (d.bankJewel + d.circulatingJewel) * 1.15,
    );
    return {
      dateDomain: [
        transformedData[0].date,
        transformedData[transformedData.length - 1].date,
      ],
      // flip to account for SVG dimensions direction
      jewelDomain: [maxJewel, 0],
    };
  }, [transformedData]);

  const { dateRange, jewelRange } = useMemo(
    () => ({
      dateRange: [MARGIN.left, width - MARGIN.right],
      jewelRange: [MARGIN.top, height - MARGIN.bottom],
    }),
    [width, height],
  );

  const [xScale, xScaleDeps] = useScale(scaleTime, dateDomain, dateRange);
  const [yScale, yScaleDeps] = useScale(scaleLinear, jewelDomain, jewelRange);
  const xAxis = useAxis(axisBottom, xScale);
  const yAxis = useAxis(axisLeft, yScale);

  const { xJewelPath, circulatingJewelPath, dataPoints } = useMemo(() => {
    const circulatingPath = path();
    const xJewelPath = path();

    const dataPoints = transformedData.map((d) => ({
      ...d,
      x: xScale(d.date),
      circulatingY: yScale(d.circulatingJewel),
      bankJewelY: yScale(d.circulatingJewel + d.bankJewel),
    }));

    dataPoints.forEach((d, index) => {
      const { x, circulatingY, bankJewelY } = d;

      if (index === 0) {
        circulatingPath.moveTo(x, circulatingY);
        xJewelPath.moveTo(x, bankJewelY);
        return;
      }

      circulatingPath.lineTo(x, circulatingY);
      xJewelPath.lineTo(x, bankJewelY);
    });

    xJewelPath.lineTo(dateRange[1], jewelRange[1]);
    xJewelPath.lineTo(dateRange[0], jewelRange[1]);
    xJewelPath.closePath();

    circulatingPath.lineTo(dateRange[1], jewelRange[1]);
    circulatingPath.lineTo(dateRange[0], jewelRange[1]);
    circulatingPath.closePath();

    return {
      dataPoints,
      xJewelPath: xJewelPath.toString(),
      circulatingJewelPath: circulatingPath.toString(),
    };
  }, [transformedData, dateRange, jewelRange, xScale, yScale]);

  const {
    svgRef,
    tooltipPosition,
    tooltipData,
    handleSVGMouseEnter,
    handleSVGMouseLeave,
    handleDataPointEnter,
    handleDataPointLeave,
  } = useSVGMousePosition();

  const shouldRenderSVGLine =
    tooltipPosition &&
    tooltipPosition.svgX >= dateRange[0] &&
    tooltipPosition.svgX <= dateRange[1];

  return (
    <>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onMouseEnter={handleSVGMouseEnter}
        onMouseLeave={handleSVGMouseLeave}
      >
        <path className={styles.xJewelPath} d={xJewelPath} />
        <path className={styles.circulatingPath} d={circulatingJewelPath} />

        {dataPoints.map((d) => (
          <DataPoint
            datum={d}
            onMouseEnter={handleDataPointEnter}
            onMouseLeave={handleDataPointLeave}
          />
        ))}

        <Axis
          axis={xAxis}
          axisDeps={xScaleDeps}
          y={height - MARGIN.bottom}
          width={width}
          height={height}
        />
        <Axis
          axis={yAxis}
          axisDeps={yScaleDeps}
          x={MARGIN.left}
          width={width}
          height={height}
        />

        {shouldRenderSVGLine && (
          <>
            <line
              className={styles.hoverLine}
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={tooltipPosition.svgY - 0.5}
              y2={tooltipPosition.svgY - 0.5}
            />
            <line
              className={styles.hoverLine}
              x1={tooltipPosition.svgX - 0.5}
              x2={tooltipPosition.svgX - 0.5}
              y1={MARGIN.top}
              y2={height - MARGIN.bottom}
            />
          </>
        )}
      </svg>

      {tooltipData && (
        <Tooltip
          datum={tooltipData}
          x={tooltipPosition.x}
          y={tooltipPosition.y}
        />
      )}
    </>
  );
};

export default Graph;
