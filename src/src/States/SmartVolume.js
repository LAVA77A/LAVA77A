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
import React from 'react';
import CircularProgress from '@material-ui/core/CircularProgress';
import Button from '@material-ui/core/Button';

import IconVolume0 from 'react-icons/lib/md/volume-mute';
import IconVolume50 from 'react-icons/lib/md/volume-down';
import IconVolume100 from 'react-icons/lib/md/volume-up';

import Theme from '../theme';
import SmartGeneric from './SmartGeneric';
import Types from './SmartTypes';
//import Dialog from './SmartDialogSlider';
import Dialog from './SmartDialogKnob';

import I18n from '../i18n';

const style = {
    mute: {
        fontSize: 'smaller',
        fontWeight: 'normal',
        paddingLeft: 10
    },
    groupText: {
        fontSize: 10,
        paddingLeft: 5
    }
};

class SmartVolume extends SmartGeneric {
    constructor(props) {
        super(props);
        if (this.channelInfo.states) {
            let state = this.channelInfo.states.find(state => state.id && state.name === 'SET');
            if (state && this.props.objects[state.id] && this.props.objects[state.id].common) {
                this.id = state.id;
            } else {
                this.id = '';
            }

            state = this.channelInfo.states.find(state => state.id && state.name === 'ACTUAL');
            this.actualId = state ? state.id : this.id;

            state = this.channelInfo.states.find(state => state.id && state.name === 'MUTE');
            this.muteId = state && state.id;

            if (this.channelInfo.type === Types.volumeGroup) {
                this.group = true;
            }
        }

        if (this.id) {
            this.max = this.props.objects[this.actualId].common.max;
            this.min = this.props.objects[this.actualId].common.min;

            this.props.tile.setState({
                isPointer: true
            });

            this.unit = this.props.objects[this.actualId].common.unit;
            this.unit = this.unit ? ' ' + this.unit : '';
        }

        this.stateRx.showDialog = false; // support dialog in this tile used in generic class)
        this.stateRx.setValue = null;
        this.key = 'smart-slider-' + this.id + '-';
        this.doubleState = true; // used in generic

        this.componentReady();
    }

    updateState(id, state) {
        let newState = {};

        if (this.actualId === id || (this.id === id && this.id === this.actualId && state.ack)) {
            const val = typeof state.val === 'number' ? state.val : parseFloat(state.val);
            if (!isNaN(val)) {
                newState[id] = val;
                this.setState(newState);

                const tileState = val !== this.min;
                this.props.tile.setState({
                    state: tileState
                });
            } else {
                newState[id] = null;
                this.setState(newState);
                this.props.tile.setState({
                    state: false
                });
            }

            // hide desired value
            if (this.state.setValue === newState[id] && state.ack) {
                this.setState({setValue: null});
            }

            if (state.ack && this.state.executing) {
                this.setState({executing: false});
            }
        } else if (id === this.id) {
            newState[id] = typeof state.val === 'number' ? state.val : parseFloat(state.val);
            this.setState(newState);
        } else {
            super.updateState(id, state);
        }
    }

    setValue(value) {
        console.log('Control ' + this.id + ' = ' + value);
        if (this.actualId !== this.id) {
            this.setState({executing: true, setValue: value});
        }
        if (this.max - this.min > 9) {
            value = Math.round(value);
        }
        this.props.onControl(this.id, value);
    }

    toggle() {
        this.props.onControl(this.muteId, !this.state[this.muteId]);
    }

    getSecondaryDiv() {
        let Icon;
        let text;
        let color;

        if (this.state[this.muteId]) {
            Icon = IconVolume0;
            text = I18n.t('mute');
            color = '#f99';
        } else {
            Icon = IconVolume100;
            text = I18n.t('unmute');
            color = 'inherit'
        }
        let customIcon;

        if (this.state.settings.useDefaultIcon) {
            customIcon = (<img src={this.getDefaultIcon()} style={{height: '100%', zIndex: 1}}/>);
        } else {
            customIcon = (<Icon width={'100%'} height={'100%'} style={{zIndex: 1}}/>);
        }

        return (<div key={this.key + 'tile-secondary'} className="tile-text-second"
                     style={Theme.tile.secondary.button} title={text}>
            <Button variant="fab" mini onClick={this.toggle.bind(this)} style={{background: color, boxShadow: 'none'}} aria-label={text}>
                {customIcon}
            </Button>
        </div>);
    }

    getIcon() {

        let customIcon;

        if (this.state.settings.useDefaultIcon) {
            customIcon = (<img src={this.getDefaultIcon()} style={{height: '100%'}}/>);
        } else {
            if (this.state.settings.icon) {
                customIcon = (<img src={this.state.settings.icon} style={{height: '100%'}}/>);
            } else {
                let IconCustom;
                const val = Math.round((this.state[this.actualId] - this.min) / (this.max - this.min) * 100);
                if (val < 25) {
                    IconCustom = IconVolume0;
                } else if (val < 75) {
                    IconCustom = IconVolume50;
                } else {
                    IconCustom = IconVolume100;
                }
                customIcon = (<IconCustom width={'100%'} height={'100%'}/>);
            }
        }
        return (
            <div key={this.key + 'icon'} style={Object.assign({}, Theme.tile.tileIcon, this.state[this.actualId] !== this.min ? {color: Theme.palette.lampOn} : {})} className="tile-icon">
                {customIcon}
                {this.state.executing ? <CircularProgress style={{position: 'absolute', top: 0, left: 0}} size={Theme.tile.tileIcon.width}/> : null}
            </div>
        );
    }

    getStateText() {
        let result = '';
        if (this.state[this.actualId] === null || this.state[this.actualId] === undefined) {
            result = '---';
        } else {
            if (this.workingId && this.state[this.workingId] && this.state.setValue !== null && this.state.setValue !== undefined) {
                if (this.max - this.min > 9) {
                    result = Math.round(this.state[this.id]) + this.unit + ' → ' + Math.round(this.state.setValue) + this.unit;
                } else {
                    result = this.roundValue(this.state[this.id], 1) + this.unit + ' → ' + this.roundValue(this.state.setValue, 1) + this.unit;
                }
            } else if (this.max - this.min > 9) {
                result = Math.round(this.state[this.id]) + this.unit;
            } else {
                result = this.roundValue(this.state[this.id], 1) + this.unit;
            }
        }
        if (this.muteId && this.state[this.muteId]) {
            result = [(<span key="value">{result}</span>), (<span key="muted" style={style.mute}>({I18n.t('muted')})</span>)];
        }
        return result;
    }

    render() {
        return this.wrapContent([
            (<div key={this.key + 'tile-icon'} className="tile-icon"
                  style={{pointerEvents: 'none'}}>{this.getIcon()}</div>),
            this.muteId && this.getSecondaryDiv(),
            (<div key={this.key + 'tile-text'} className="tile-text" style={Theme.tile.tileText}>
                <div className="tile-channel-name" style={Object.assign({}, Theme.tile.tileName, this.state.nameStyle)}>
                    {this.state.settings.name}
                    {this.group ? (<span style={style.groupText}>{I18n.t('group')}</span>) : null}
                </div>
                <div className="tile-state-text"
                     style={Theme.tile.tileState}>{this.getStateText()}</div>
            </div>),
            this.state.showDialog ?
                <Dialog key={this.key + 'dialog'}
                        startValue={this.state[this.id]}
                        startMuteValue={this.muteId ? this.state[this.muteId] : false}
                        onMute={this.muteId ? this.toggle.bind(this) : null}
                        windowWidth={this.props.windowWidth}
                        min={this.min}
                        max={this.max}
                        unit={this.unit}
                        onValueChange={this.setValue.bind(this)}
                        onClose={this.onDialogClose.bind(this)}
 //                       type={Dialog.types.value}
                /> : null
        ]);
    }
}

export default SmartVolume;

