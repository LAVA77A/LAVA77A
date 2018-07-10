import React from 'react';
import SmartGeneric from './SmartGeneric';
import IconThermometer from '../icons/ThermometerSimple';
import IconHydro from '../icons/Humidity';
import IconInfo from 'react-icons/lib/md/info';
import Utils from '../Utils';

import Theme from '../theme';
import I18n from '../i18n';
import Dialog from './SmartDialogInfo';
import PropTypes from 'prop-types';

const invisibleDefaultRoles = [
    /^timer.off$/,
    /^inhibit$/,
];

class SmartInfo extends SmartGeneric {
    // expected:
    static propTypes = {
        tile:               PropTypes.object.isRequired,
        objects:            PropTypes.object.isRequired,
        states:             PropTypes.object.isRequired,
        onCollectIds:       PropTypes.func,
        onControl:          PropTypes.func
    };

    constructor(props) {
        super(props);
        let hasControls = false;
        if (this.channelInfo.states) {
            let infoIDs = this.channelInfo.states.filter(state => state.id && state.name === 'ACTUAL').map(state => state.id);
            // place numbers first
            if (infoIDs.length > 1) {
                infoIDs.sort((a, b) => {
                    const objA = this.props.objects[a];
                    const objB = this.props.objects[b];
                    const typeA = objA && objA.common && objA.common.type;
                    const typeB = objB && objB.common && objB.common.type;
                    if (typeA && !typeB) return 1;
                    if (!typeA && typeB) return -1;
                    if (typeA === 'number' && typeB !== 'number') return -1;
                    if (typeA !== 'number' && typeB === 'number') return 1;
                    return 0;
                });
            }
            if (infoIDs[0]) {
                this.id = infoIDs[0];
            } else {
                this.id = '';
            }

            if (infoIDs[1]) {
                this.secondary  = {
                    id: infoIDs[1]
                };
            }
            const name = this.getObjectNameCh();
            this.infos = infoIDs.map(id => SmartInfo.getObjectAttributes(this.props.objects, id, name));
            hasControls = !!this.infos.find(item => item.common && item.common.write);
        }

        if (!this.infos.find(state => !invisibleDefaultRoles.find(test => !test.test(state.role)))) {
            this.defaultEnabling = false;
        } else {
            console.log('Visible!');
        }

        // make tile with opacity 1
        this.props.tile.state.state = true;

        if (this.infos && (this.infos.length > 2 || hasControls)) {
            this.stateRx.showDialog = false; // support dialog in this tile (used in generic class)
        }

        this.props.tile.setState({
            isPointer: this.showCorner
        });

        this.key = 'smart-info-' + this.id + '-';

        this.componentReady();
    }

    static getObjectAttributes(objects, id, channelName) {
        if (!id || !objects[id] || !objects[id].common) return null;
        const role = objects[id].common.role || '';
        const unit = objects[id].common.unit || '';
        let  title = objects[id].common.name || id.split('.').pop();
        if (!title) {
            title = id.split('.').pop();
        }
        if (typeof title === 'object') {
            title = title[I18n.getLanguage()] || title.en || id.split('.').pop();
        }

        title = title.replace(/[._]/g, ' ').trim();
        if (title.toUpperCase() !== channelName.toUpperCase()) {
            title = title.replace(channelName, '').trim();
        }

        title = Utils.splitCamelCase(title);

        if (role.match(/humidity/i)) {
            return {
                id: id,
                icon: IconHydro,
                iconStyle: {color: '#0056c3'},
                unit: unit ? ' ' + unit : ' %',
                role: role,
                name: title,
                common: objects[id].common
            }
        } else if (role.match(/temperature/i)) {
            return {
                id: id,
                icon: IconThermometer,
                iconStyle: {color: '#e54100'},
                unit: unit ? ' ' + unit : '°',
                name: title,
                role: role,
                common: objects[id].common
            }
        } else {
            return {
                id: id,
                unit: unit ? ' ' + unit : '',
                icon: objects[id].common && objects[id].common.icon,
                name: title,
                role: role,
                common: objects[id].common
            }
        }
    }

    updateState(id, state) {
        if (this.infos && this.infos.find(e => e.id === id)) {
            const newState = {};
            newState[id] = state.val;
            this.setState(newState);
        } else {
            super.updateState(id, state);
        }
    }

    getIcon() {
        let Icon = this.infos[0].icon || IconInfo;
        return (
            <div key={this.key + 'icon'} style={Object.assign({}, Theme.tile.tileIcon, this.infos[0].iconStyle || {})} className="tile-icon">
                <Icon style={{zIndex: 1}} width={'100%'} height={'100%'}/>
            </div>
        );
    }

    getStateText() {
        const state = this.state[this.id];
        return state === undefined || state === null ? '?' : state + this.infos[0].unit;
    }

    getSecondaryDiv() {
        if (!this.infos || !this.infos[1] || !this.infos[1].id || this.state[this.infos[1].id] === undefined || this.state[this.infos[1].id] === null) {
            return null;
        }
        let val = this.state[this.infos[1].id];
        const icon = this.infos[1].icon;
        let Icon;
        if (icon) {
            if (typeof icon === 'object') {
                Icon = icon;
                Icon = (<Icon style={Object.assign({}, Theme.tile.secondary.icon, this.infos[1].iconStyle || {})} />);
            } else {
                Icon = (<img alt={this.infos[1].name} src={icon} style={Object.assign({}, Theme.tile.secondary.icon, this.infos[1].iconStyle || {})}/>)
            }
        }

        return (<div key={this.key + 'tile-secondary'} className="tile-text-second" style={Theme.tile.secondary.div} title={this.infos[1].name}>
            {Icon}
            <span style={Theme.tile.secondary.text}>{val + this.infos[1].unit}</span>
        </div>);
    }

    getNumberOfValuesIndicator() {
        if (this.infos.length <= 2) return null;
        return (<div key={this.key + 'tile-number'} style={Theme.tile.tileNumber} title={I18n.t('Show %s values', this.infos.length)}>{this.infos.length}</div>);
    }
    getFirstName() {
        this.firstName = this.firstName || I18n.t(Utils.CapitalWords(this.id.split('.').pop()));

        return [(<span key={this.key + 'tile-name'}>{this.state.settings.name} </span>),(<span key={this.key + 'tile-first-name'} style={Theme.tile.tileNameSmall}>{this.firstName}</span>)];
    }

    setValue(id, value) {
        console.log('Control ' + id + ' = ' + value);
        this.props.onControl(id, value);
    }

    render() {
        return this.wrapContent([
            (<div key={this.key + 'tile-icon'} className="tile-icon">{this.getIcon()}</div>),
            this.getSecondaryDiv(),
            this.getNumberOfValuesIndicator(),
            (<div key={this.key + 'tile-text'} className="tile-text" style={Theme.tile.tileText}>
                <div className="tile-channel-name" style={Object.assign({}, Theme.tile.tileName, this.state.nameStyle)} title={this.id}>{this.getFirstName()}</div>
                <div className="tile-state-text"  style={Object.assign({}, Theme.tile.tileState, this.state[this.actualId] ? Theme.tile.tileStateOn : Theme.tile.tileStateOff, {fontSize: 18})}>{this.getStateText()}</div>
            </div>),
            this.state.showDialog ?
                <Dialog key={this.key + 'dialog'}
                        dialogKey={this.key + 'dialog'}
                        windowWidth={this.props.windowWidth}
                        points={this.infos}
                        onCollectIds={this.props.onCollectIds}
                        name={this.state.settings.name}
                        onValueChange={this.setValue.bind(this)}
                        onClose={this.onDialogClose.bind(this)}
                        objects={this.props.objects}
                        states={this.props.states}
                /> : null
        ]);
    }
}

export default SmartInfo;

