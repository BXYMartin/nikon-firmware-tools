import React, { Component } from 'react';
import './App.css';
import { saveAs } from 'file-saver';

/*global _detectFirmware _patch_firmare _getInFilePtr _getOutFilePtr _getJsonPtr _getMaxFileSize _getSelectPtr Module EventFunction*/


class FirmwareControl extends Component {
    constructor(props){
        super(props);
        this.handleSelectClick = this.handleSelectClick.bind(this);
        this.handleSaveClick = this.handleSaveClick.bind(this);
        this.handlePatchClick = this.handlePatchClick.bind(this);
        this.handleAcceptClick = this.handleAcceptClick.bind(this);
        var patchSet = new Map()
        this.state = {hasPatchesSelect: false, patchSet:patchSet, patches: [], warnShow: false, warnAccept: false};
    }

    checkButtonState(s, wa){
        var a = false;
        var maxlevel = "";
        var ws = this.state.warnShow;
        s.forEach((v,k) => {
            a= a || v;
            var patch = this.state.patches.find((p)=>p.id===k);
            if(v && patch.level!=="Released"){
                maxlevel = maxlevel>patch.level?maxlevel:patch.level;
            }
        });
        if(a === false){
            wa = false;
        }
        if(maxlevel === ""){
            ws = false;
        }else{
            ws = true;
            a = a & wa;
        }
        this.setState({hasPatchesSelect:a, warnShow: ws, warnAccept: wa});
    }

    handleAcceptClick() {
        this.checkButtonState(this.state.patchSet, true);
    }

    handleSelectClick() {
        var inputfile = document.getElementById('inputfile');
    
        if (inputfile.files.length === 0)
                return;
        var file = inputfile.files[0];
        EventFunction("TryFile",file.name);
        var maxFileSize = _getMaxFileSize();
        if (file.size > maxFileSize)
            return;

        var patches = {"model":"Unknown", "version":"Unknown", "patches":[]};
        var fr = new FileReader();
        fr.onload = function () {
            EventFunction("OpenFile",file.name);
            var data = new Uint8Array(fr.result);
            var data_mem = _getInFilePtr();
            Module.HEAPU8.set(data, data_mem);

            var outcount = _detectFirmware(data.length);
            if(outcount>0){
                var out_mem = _getJsonPtr();
                let s = "";
                for (let i = 0; i < outcount; ++i){
                    s += String.fromCharCode(Module.getValue(out_mem+i));
                }
                patches = JSON.parse(s);
            }
            var patchSet = new Map()
            var pp = patches["patches"];
            var _model = patches["model"];
            var _version = patches["version"];

            pp.forEach((patch) => patchSet.set(patch.id,false) );
            this.setState({patchSet:patchSet, patches: pp, filename: file.name, model: _model, version: _version, warnShow: false, warnAccept: false})
        }.bind(this);
        fr.readAsArrayBuffer(file);
    }
    
    handleSaveClick(){
        var selected = [];
        for (var [key, value] of this.state.patchSet.entries()) {
            if( value){
                selected.push(parseInt(key,10));
            }
        }
        var select_ptr = _getSelectPtr();
        Module.HEAPU32.set(selected, select_ptr/4);

        var ret = _patch_firmare(selected.length);

        if(ret>0){
            EventFunction("SaveFile",selected.toString());
            var outptr = _getOutFilePtr();
            var data = new Uint8Array(Module.HEAPU8.buffer, outptr, ret);
            var blob = new Blob([data], {type: 'binary/octet-stream'});
            saveAs(blob, "patched_"+this.state.filename, true);
        }
    }

    handlePatchClick(id, set){
        var s = this.state.patchSet;
        var wa = this.state.warnAccept;
        
        s.set(id,set)
        if(set){
            var patch = this.state.patches.find((p)=>p.id===id);
            if(patch){
                patch.blocks.forEach((b)=>s.set(b,false));
            }
        }
        this.checkButtonState(s, wa);
        this.setState({patchSet:s});
    }

    render(){
        let content = null;
        if(this.state.patches.length > 0){
            content = <table><tbody>
                {this.state.patches.map((patch) =>
            <PatchRow key={patch.id.toString()} 
                id={patch.id}
                name={patch.name}
                level={patch.level}
                set={this.state.patchSet.get(patch.id)}
                onTrySet={this.handlePatchClick} />)}
            </tbody></table>;
        } else {
            if(this.state.model === "Unknown"){
                content = <label>This is ether not a Nikon firmware .bin file or it is not recognised by the Patch Tool</label>;
            }else if(this.state.model){
                content = <label>This firmware file is recognised, but the are no patches availible for this Model/Version</label>;
            }
        }
        let warnContext = null;
        if(this.state.warnShow){
            warnContext = <div>
                <label>You have selected Beta or Alpha level patches.</label>
                <ul><li class="Beta">Beta level patches might not work correctly but can be recovered from.</li>
                <li class="Alpha">Alpha level patches might not work AND might not be recoverable from. These could damage your camera!</li></ul>
                <button onClick={this.handleAcceptClick} disabled={this.state.warnAccept}>{this.state.warnAccept?"Accepted":"Accept"}</button>
            </div>
        }
        return (<div> 
            <input type="file" id="inputfile" name="select file" accept=".bin" onChange={this.handleSelectClick} />
            <button onClick={this.handleSaveClick} disabled={!this.state.hasPatchesSelect}>Save Patched Firmware File</button>
            <hr/>
            <label>Model: {this.state.model}&nbsp;</label>
            <label>Version: {this.state.version}</label>
            <hr/>
            {content}
            <hr/>
            {warnContext}
        </div>
        );
    }
}

class PatchRow extends Component {
    constructor(props) {
        super(props);
        this.handleClick = this.handleClick.bind(this);
    }
    handleClick(e) {
        this.props.onTrySet(this.props.id, !this.props.set);
    }
    render() {
        return (
            <tr className={this.props.level} onClick={this.handleClick}>
                <td><button>{this.props.set ? '*': '_'}</button></td>
                <td>{this.props.name}</td>
            </tr>
        );
    }
}

class App extends Component {
  render() {
    return (
      <div className="App">
        <FirmwareControl/>
      </div> 
    );
  }
}

export default App;
