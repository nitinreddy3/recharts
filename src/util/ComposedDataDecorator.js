import React, { Component, PropTypes } from 'react';
import _ from 'lodash';
import { shallowEqual } from './PureRender';
import { getDisplayName, findAllByType } from './ReactUtils';
import { getStackedDataOfItem, getTicksOfAxis,
  getBarSizeList, getBarPosition } from './CartesianUtils';
import { getBandSizeOfAxis } from './DataUtils';

/*
 * ComposedDataDecorator is a wrapper component that calculates expensive,
 * reusable data like ticks of an axis, stores it in state on this component,
 * and passes it in as props to the wrapped component.
 */
export default ({ getComposedData, ChildComponent }) => WrappedComponent =>
  class ComposedDataDecorator extends Component {
    static displayName = `ComposedDataDecorator(${getDisplayName(WrappedComponent)})`;

    static propTypes = {
      ...WrappedComponent.propTypes,
      chartX: PropTypes.number,
      chartY: PropTypes.number,
      data: PropTypes.array,
    };

    // static WrappedComponent = WrappedComponent;

    static defaultProps = WrappedComponent.defaultProps;

    state = this.calculateExpensiveState({ props: this.props }) ;

    /**
     * @param {Object} props The props object to operate on
     * @return {Object} returnObj
     *  returnObj {Array} axisTicks Used by renderCursor and anything
     *          else that needs the ticks of the axisTicks
     *  returObj {Array} allComposedData An array or arrays.
     *          Each top-level element is the composedData {points, baseLine, layout}
     *          for a given child(graphcalItem) of the overall Chart
     */
    calculateExpensiveState({ props }) {
      const { children, graphicalItems, xAxisMap, yAxisMap, stackGroups,
        layout, offset, barSize, barGap, barCategoryGap,
        maxBarSize: globalMaxBarSize } = props;

      // Some charts pre-filter their items into the graphicalItems prop,
      // others filter it in render of the children
      const items = graphicalItems || findAllByType(children, ChildComponent);

      const sizeList = getBarSizeList({ barSize, stackGroups });

      let axisTicks;
      const allComposedData = [];
      items.forEach((item) => {
        const { xAxisId, yAxisId, dataKey, maxBarSize: childMaxBarSize } = item.props;
        let xAxis, yAxis, xTicks, yTicks, barPosition, stackedData, bandSize;

        if (xAxisMap || yAxisMap) {

          xAxis = xAxisMap[xAxisId];
          yAxis = yAxisMap[yAxisId];

          xTicks = getTicksOfAxis(xAxis);
          yTicks = getTicksOfAxis(yAxis);

          // axisTicks is more global - only need to set once
          axisTicks = axisTicks || (layout === 'horizontal' ? xTicks : yTicks);

          const numericAxisId = layout === 'horizontal' ? yAxisId : xAxisId;
          const cateAxisId = layout === 'horizontal' ? xAxisId : yAxisId;
          const cateAxis = layout === 'horizontal' ? xAxis : yAxis;
          const cateTicks = layout === 'horizontal' ? xTicks : yTicks;

          stackedData = stackGroups && stackGroups[numericAxisId] &&
            stackGroups[numericAxisId].hasStack &&
            getStackedDataOfItem(item, stackGroups[numericAxisId].stackGroups);

          bandSize = getBandSizeOfAxis(cateAxis, cateTicks);
          const maxBarSize = _.isNil(childMaxBarSize) ? globalMaxBarSize : childMaxBarSize;
          barPosition = getBarPosition({
            barGap, barCategoryGap, bandSize, sizeList: sizeList[cateAxisId], maxBarSize,
          });

        }

        const composedData = getComposedData && getComposedData({ props,
          xAxis, yAxis, xTicks, yTicks, dataKey, item, bandSize, barPosition, offset, stackedData,
        }) || {};
        allComposedData.push(composedData);
      });

      return { axisTicks, allComposedData };
    }
  /*
  * Update the state of the composedData if anything relevant changed
  */
  /* eslint-disable no-unused-vars */
    componentWillReceiveProps(nextProps) {

      const { graphicalItems, children, chartX, chartY,
        activeTooltipIndex, isTooltipActive, ...restNextProps } = nextProps;

      const { graphicalItems: graphicalItemsOld, children: childrenOld,
        chartX: chartXOld, chartY: chartYOld, activeTooltipIndex: aTIOld,
        isTooltipActive: iTAOld, ...restOldProps } = this.props;

      /* eslint-enable no-unused-vars */
      if (!shallowEqual(graphicalItems, graphicalItemsOld) ||
          !shallowEqual(children, childrenOld) ||
          !shallowEqual(restNextProps, restOldProps)) {
        this.setState(this.calculateExpensiveState({ props: nextProps }));
      }
    }
  /*
   * Ignore the state generated by calculateExpensiveState when determining
   * whether to update
   */
    shouldComponentUpdate({ graphicalItems, ...restProps }, nextState) {
    // props.graphicalItems is sometimes generated every time -
    // check that specially as object equality is likely to fail
      const { graphicalItems: graphicalItemsOld, ...restPropsOld } = this.props;
      return !shallowEqual(graphicalItems, graphicalItemsOld) ||
        !shallowEqual(restProps, restPropsOld)
        || !shallowEqual(nextState, this.state);
    }

    render() {
      return <WrappedComponent {...this.props} {...this.state} />;
    }
  };
