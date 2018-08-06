/**
 * Copyright 2018 bluefox <dogafox@gmail.com>
 *
 * Licensed under the Creative Commons Attribution-NonCommercial License, Version 4.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://creativecommons.org/licenses/by-nc/4.0/legalcode.txt
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
import React, {Component} from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import ButtonBase from '@material-ui/core/ButtonBase';

import IconUnreach from 'react-icons/lib/md/perm-scan-wifi';
import IconGrip from 'react-icons/lib/md/drag-handle';
import IconLight from 'react-icons/lib/ti/lightbulb';

import Utils from './Utils';
import Theme from './theme';
import I18n from './i18n';
import SmartTile from './SmartTile';
import SmartDetector from './States/SmartDetector';
import Types from './States/SmartTypes';
import VisibilityButton from './basic-controls/react-visibility-button/VisibilityButton';

const styles = {
    'drag-item': {
        display: 'inline-block'
    },
    'drag-item-overlay': {
        backgroundColor: 'green',
        borderRadius: '1em'
    },
    'sub-list-disabled-overflow': {
        top: 0,
        bottom: 0,
        position: 'absolute',
        right: 0,
        left: 0,
        zIndex: 2,
        backgroundColor: 'rgba(90,90,90,0.5)'
    }
};

class StatesSubList extends Component {

    static propTypes = {
        enumID:         PropTypes.string.isRequired,
        enumSubID:      PropTypes.string.isRequired,
        user:           PropTypes.string.isRequired,
        objects:        PropTypes.object.isRequired,
        editMode:       PropTypes.bool.isRequired,
        debug:          PropTypes.bool,
        ignoreIndicators: PropTypes.array,
        onSaveSettings: PropTypes.func,
        windowWidth:    PropTypes.number,
        align:          PropTypes.string,
        newLine:        PropTypes.bool,
        subDragging:    PropTypes.bool,
        dragHandleProps: PropTypes.object,
        isUseBright:    PropTypes.bool,
        states:         PropTypes.object.isRequired,
        keys:           PropTypes.array.isRequired
    };

    constructor(props) {
        super(props);
        this.detector = new SmartDetector();
        const settings = Utils.getSettings(this.props.objects[this.props.enumSubID], {user: this.props.user});

        this.state = {
            visible: false,
            newLine: false,
            align: this.props.align,
            enumID: this.props.enumID,
            subDragging: this.props.subDragging,
            enumSubID: this.props.enumSubID,
            enabled: settings && settings.subEnabled ? (settings.subEnabled[this.props.enumID] === undefined ? true : settings.subEnabled[this.props.enumID]) : true,
            order: Utils.getSettingsOrder(this.props.objects[this.props.enumSubID], this.props.enumID, {user: this.props.user}),
            dragging: false,
            visibleChildren: {}
        };
        if (this.state.enumID === Utils.INSTANCES) {
            this.name = I18n.t('All instances');
        } else {
            this.name = this.state.enumSubID && this.state.enumSubID !== 'others' ? Utils.getObjectName(this.props.objects, this.state.enumSubID, false, {language: I18n.getLanguage()}) : I18n.t('Others');
        }
        this.widgetTypes = {};
        this.collectVisibility = null;
        this.collectVisibilityTimer = null;
    }

    componentWillUpdate(nextProps, nextState) {
        const newState = {};
        let changed = false;

        if (nextProps.newLine !== this.state.newLine) {
            newState.newLine = nextProps.newLine;
            changed = true;
        }

        if (nextProps.align !== this.state.align) {
            newState.align = nextProps.align;
            changed = true;
        }

        if (nextProps.subDragging !== this.state.subDragging) {
            newState.subDragging = nextProps.subDragging;
            changed = true;
        }

        if (nextProps.editMode !== this.state.editMode) {
            this.order = null;
        }

        if (nextProps.enumID !== this.state.enumID) {
            newState.enumID = nextProps.enumID;
            newState.visibleChildren = {};
            newState.visible = false;
            changed = true;
        }
        if (nextProps.enumSubID !== this.state.enumSubID) {
            this.name = nextProps.enumSubID ? Utils.getObjectName(this.props.objects, nextProps.enumSubID, false, {language: I18n.getLanguage()}) : I18n.t('Others');
            newState.enumSubID = nextProps.enumSubID;
            newState.visibleChildren = {};
            newState.visible = false;
            changed = true;
        }
        if (changed) {
            this.setState(newState);
        }
    }

    onDragStart() {
        this.setState({dragging: true});
    }

    onDragEnd(result) {
        const newState = {dragging: false};

        if (result.destination && result.destination.index !== result.source.index) {
            this.order = Utils.reorder(this.order, result.source.index, result.destination.index);
            newState.order = this.order;
            const settings = Utils.getSettings(this.props.objects[this.props.enumSubID], {user: this.props.user});
            settings.subOrder = settings.subOrder || {};
            settings.subOrder[this.props.enumID] = this.order.filter(id => this.state.visibleChildren[id]);
            this.props.onSaveSettings && this.props.onSaveSettings(this.props.enumSubID, settings);
        }

        this.setState(newState);
    }

    onToggleSubEnabled() {
        const settings = Utils.getSettings(this.props.objects[this.props.enumSubID], {user: this.props.user});
        settings.subEnabled = settings.subEnabled || {};
        let enabled = settings.subEnabled[this.props.enumID] === undefined ? true : settings.subEnabled[this.props.enumID];
        enabled = !enabled;
        settings.subEnabled[this.props.enumID] = enabled;
        this.props.onSaveSettings && this.props.onSaveSettings(this.props.enumSubID, settings, () => {
            this.setState({enabled});
        });
    }

    onVisibilityTimer() {
        this.collectVisibilityTimer = null;
        let commonVisible = false;
        const newState = {visibleChildren: commonVisible};
        if (this.props.editMode || this.state.enabled) {
            const combinedVisibility = Object.assign({}, this.state.visibleChildren, this.collectVisibility);
            for (const _id in combinedVisibility) {
                if (combinedVisibility.hasOwnProperty(_id) && combinedVisibility[_id]) {
                    commonVisible = true;
                    break;
                }
            }
            newState.visibleChildren = combinedVisibility;
        }

        if (this.state.visible !== commonVisible) {
            newState.visible = commonVisible;
            this.props.onVisibilityControl && this.props.onVisibilityControl(this.state.enumSubID, commonVisible);
        }

        this.setState(newState);
        this.collectVisibility = null;
    }

    onVisibilityControl(id, visible) {
        const oldState = this.collectVisibility && this.collectVisibility[id] !== undefined ? this.collectVisibility[id] : this.state.visibleChildren[id];

        if (oldState !== visible) {
            this.collectVisibility = this.collectVisibility || {};
            this.collectVisibility[id] = visible;
            if (this.collectVisibilityTimer) {
                clearTimeout(this.collectVisibilityTimer);
            }
            this.collectVisibilityTimer = setTimeout(() => this.onVisibilityTimer(), 0);
        }
    }

    createControl(control, channelId, channelInfo, i) {
        const state = channelInfo.states.find(state => state.id);

        let Component = control; // This will be used by rendering
        //              ↓
        return (<Component
            key={state.id + '-sublist-' + Component.name + '-' + i}
            id={channelId}
            enumNames={[this.name, Utils.getObjectName(this.props.objects, this.state.enumID, null, {language: I18n.getLanguage()})]}
            enumFunctions={this.props.enumFunctions}
            editMode={this.props.editMode}
            channelInfo={channelInfo}
            ignoreIndicators={this.props.ignoreIndicators}
            windowWidth={this.props.windowWidth}
            states={this.props.states}
            objects={this.props.objects}
            user={this.props.user}
            onVisibilityControl={this.onVisibilityControl.bind(this)}
            onSaveSettings={this.props.onSaveSettings}
            onCollectIds={this.props.onCollectIds}
            onControl={this.props.onControl}
        />);
    }

    getListItems(items) {
        const usedIds = [];

        if (this.props.enumID === Utils.INSTANCES) {
            return items.map(function (id, i) {
                return {
                    control: this.createControl(SmartTile, id, {
                        states: [
                            {id: id + '.alive',     name: 'ALIVE'},
                            {id: id + '.connected', name: 'UNREACH', type: 'boolean', indicator: true, icon: IconUnreach, color: Theme.tile.tileIndicatorsIcons.unreach}
                        ],
                        type: Types.instance
                    }, i),
                    visible: true
                };
            }.bind(this));
        }

        const controls = items.map(function (id, i) {
            if (this.state[id] === undefined) {
                //debugger;
            }

            let controls = this.detector.detect(this.props.objects, id, this.props.keys, usedIds, this.props.ignoreIndicators);
            if (controls) {
                controls = controls.map(function (control) {
                    const id = control.states.find(state => state.id).id;
                    if (id) {
                        this.widgetTypes[id] = {
                            type:   control.type,
                            SET:    control.states.find(state => state.name === 'SET'),
                            ON_SET: control.states.find(state => state.name === 'ON_SET'),
                            STOP:   control.states.find(state => state.name === 'STOP'),
                        };
                        for (let a in this.widgetTypes[id]) {
                            if (this.widgetTypes[id].hasOwnProperty(a) && a !== 'type' && this.widgetTypes[id][a]) {
                                this.widgetTypes[id][a] = this.widgetTypes[id][a].id;
                            }
                        }

                        return {control, id};
                    }
                }.bind(this));
            } else {
                this.props.debug && console.log('Nothing found for ' + id);
            }
            if (!controls || !controls.length) {
                return null;
            } else if (controls.length === 1) {
                return controls[0];
            } else {
                return controls;
            }
        }.bind(this));

        // join all arrays in one
        let result = [];
        controls.forEach(c => {
            if (c instanceof Array) {
                result = result.concat(c);
            } else if (c) {
                result.push(c);
            }
        });

        // place visible first
        result.sort(function (a, b) {
            const av = this.state.visibleChildren[a.id];
            const bv = this.state.visibleChildren[b.id];
            if (av < bv) return 1;
            if (av > bv) return -1;
            return 0;
        }.bind(this));

        if (!this.order) {
            this.order = this.state.order;
            if (!this.order) {
                this.order = result.map(c => c.id);
            } else {
                // add missing IDs
                result.forEach(c => this.order.indexOf(c.id) === -1 && this.order.push(c.id));

                // remove deleted IDs
                for (let i = this.order.length - 1; i >= 0; i--) {
                    // if ID does not exist any more
                    if (!result.find(c => this.order[i] === c.id)) {
                        this.order.splice(i, 1);
                    }
                }
            }
        }

        return this.order.map(function (id, i) {
            const c = result.find(c => c.id === id);
            return {control: this.createControl(SmartTile, c.id, c.control, i), id: c.id};
        }.bind(this));
    }

    wrapItem(item, index) {
        if (this.state.visibleChildren[item.id]) {
            const key = 'item-' + this.state.enumID + '-' + this.state.enumSubID + '-' + item.id;
            return (<Draggable key={key} draggableId={key} index={index}>
                {(provided, snapshot) => (
                    <div
                        className={this.props.classes['drag-item'] + (snapshot.isDragging ? ' ' + this.props.classes['drag-item-overlay'] : '')}
                        style={{display: 'inline-block'}}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                    >
                        {item.control}
                    </div>
                )}
            </Draggable>);
        } else {
            return (<div key={'item-' + item.id}>{item.control}</div>);
        }
    }

    wrapAllItems(items, provided, snapshot) {
        const style = {display: 'flex'};
        if (this.state.dragging) {
            style.background = 'rgba(2,173,2,0.26)';
            style.borderRadius = '1em';
        }

        return (
            <div style={{width: '100%', overflow: 'auto'}}>
                <div style={style} ref={provided.innerRef} {...provided.droppableProps}>
                    {items.map((item, index) => this.wrapItem(item, index))}
                    {provided.placeholder}
                </div>
            </div>);
    }

    wrapContent(items) {
        if (this.state.subDragging && this.props.editMode && this.props.enumID !== Utils.INSTANCES && this.state.enabled) {
            return(
                <DragDropContext
                    onDragEnd={result => this.onDragEnd(result)}
                    onDragStart={() => this.onDragStart()}>
                    <Droppable droppableId={(this.state.enumID + '-' + this.state.enumSubID).replace(/[^\w\d]/g, '_') + '-droppable'} direction="horizontal">
                        {(provided, snapshot) => this.wrapAllItems(items, provided, snapshot)}
                    </Droppable>
                </DragDropContext>
            );
        } else if (this.props.editMode || (!this.state.subDragging || !this.state.enabled)) {
            return(
                <div  key={(this.state.enumID + '-' + this.state.enumSubID).replace(/[^\w\d]/g, '_') + '-inset'} style={{width: '100%', overflow: 'auto', opacity: this.state.enabled ? 1 : 0.5}}>
                    <div key="inline-div" style={{display: 'flex'}}>
                        {items.map(e => (<div key={'inline-div-' + e.id}>{e.control}</div>))}
                    </div>
                </div>
            );
        } else {
            return(<div key="inline-div">{items.map(e => e.control)}</div>);
        }
    }

    controlAllLights(isOn) {
        for (let id in this.widgetTypes) {
            if (!this.widgetTypes.hasOwnProperty(id)) continue;
            if (this.widgetTypes[id].type === Types.dimmer) {
                if (this.widgetTypes[id].ON_SET) {
                    this.props.onControl(this.widgetTypes[id].ON_SET, isOn);
                } else if (this.widgetTypes[id].SET) {
                    this.props.onControl(this.widgetTypes[id].SET, isOn ? this.props.objects[this.widgetTypes[id].SET].common.max : this.props.objects[this.widgetTypes[id].SET].common.min);
                }
            } else if (this.widgetTypes[id].type === Types.light && this.widgetTypes[id].SET) {
                this.props.onControl(this.widgetTypes[id].SET, isOn);
            }
        }
    }

    getControlAll() {
        if (this.props.editMode) return null;

        let countLights = 0;
        for (let id in this.widgetTypes) {
            if (this.widgetTypes.hasOwnProperty(id) &&
                (this.widgetTypes[id].type === Types.light || this.widgetTypes[id].type === Types.dimmer))
            {
                countLights++;
            }
        }
        if (countLights > 1) {
            return [
                (<ButtonBase variant="fab" mini aria-label="Off" onClick={() => this.controlAllLights(false)} style={Object.assign({}, Theme.buttonAllLight, {background: Theme.palette.lampOff})} title={I18n.t('All lights off')}><IconLight /></ButtonBase>),
                (<ButtonBase variant="fab" mini aria-label="On"  onClick={() => this.controlAllLights(true)}  style={Object.assign({}, Theme.buttonAllLight, {background: Theme.palette.lampOn})} title={I18n.t('All lights on')}><IconLight /></ButtonBase>)
            ];
        } else {
            return null;
        }
    }

    render() {
        if (this.props.items && this.props.items.length) {
            let items = this.getListItems(this.props.items);
            items = items.filter(e => e);
            if (items.length) {
                const visible = this.state.visible || this.props.editMode;

                const style = !visible ? {display: 'none'} : (this.state.newLine || this.props.editMode ? {display: 'block', border: 'none'} : {display: 'inline-block'});

                if (this.state.align) {
                    style.textAlign = this.state.align;
                }

                const visibilityButton = this.props.editMode ? <VisibilityButton
                    big={true}
                    style={{display: 'inline-block', marginLeft: 15}}
                    visible={this.state.enabled}
                    useBright={this.props.isUseBright}
                    onChange={() => this.onToggleSubEnabled()}/> : null;

                //style={Object.assign({}, Theme.list.row, {display: display})}
                return (
                    <div key={(this.state.enumID + '-' + this.state.enumSubID).replace(/[^\w\d]/g, '_') + '-title'}
                             style={Object.assign({}, Theme.list.row, style)}>
                        <h3 {...this.props.dragHandleProps} style={Object.assign({}, Theme.list.title, {color: this.props.isUseBright ? 'white' : 'black'})}>
                            {this.props.editMode ? (<IconGrip style={{color: this.props.isUseBright ? 'white' : 'black', width: 24, height: 24, float: 'left', opacity: this.state.subDragging ? 0 : 1}}/>) : null}
                            {this.name}
                            {this.getControlAll()}
                            {visibilityButton}
                        </h3>
                        {this.wrapContent(items)}
                    </div>);
            } else {
                if (this.props.editMode) {
                    return (<div {...this.props.dragHandleProps}/>);
                } else {
                    return null;
                }
            }
        } else {
            if (this.props.editMode) {
                return (<div {...this.props.dragHandleProps}/>);
            } else {
                return null;
            }
        }
    }
}

export default withStyles(styles)(StatesSubList);