import {resMan} from '../global/Tw2ResMan';
import {device} from '../global/Tw2Device';
import {store} from '../global/Tw2Store';
import {Tw2TextureParameter, Tw2VariableParameter} from '../parameter';

/**
 * Tw2Effect
 * @property {string} name
 * @property {string} effectFilePath
 * @property {Tw2EffectRes|null} effectRes
 * @property {Object.<string, Parameter>} parameters
 * @property {Array} passes
 * @property {Array} samplerOverrides
 * @constructor
 */
export function Tw2Effect()
{
    this.name = '';
    this.effectFilePath = '';
    this.effectRes = null;
    this.parameters = {};
    this.passes = [];
    this.samplerOverrides = [];
}

/**
 * Initializes the Tw2Effect
 * @prototype
 */
Tw2Effect.prototype.Initialize = function()
{
    if (this.effectFilePath !== '')
    {
        var path = this.effectFilePath;
        var dot = path.lastIndexOf('.');
        path = path.toLowerCase().substr(0, dot).replace('/effect/', device.effectDir) + '.sm_' + device.shaderModel;
        this.effectRes = resMan.GetResource(path);
        this.effectRes.RegisterNotification(this);
    }
};

/**
 * Gets all effect res objects
 * @param {Array} [out=[]] - Optional receiving array
 * @returns {Array.<Tw2EffectRes|Tw2TextureRes>} [out]
 */
Tw2Effect.prototype.GetResources = function(out)
{
    if (out === undefined)
    {
        out = [];
    }

    if (this.effectRes !== null)
    {
        if (out.indexOf(this.effectRes) === -1)
        {
            out.push(this.effectRes);
        }
    }

    for (var param in this.parameters)
    {
        if (this.parameters.hasOwnProperty(param))
        {
            if (this.parameters[param] instanceof Tw2TextureParameter)
            {
                this.parameters[param].GetResource(out);
            }
        }
    }

    return out;
};

/**
 * Returns the Tw2Effect's resource object
 * @prototype
 */
Tw2Effect.prototype.GetEffectRes = function()
{
    return this.effectRes;
};

/**
 * Rebuilds Cached Data
 * @param resource
 * @prototype
 */
Tw2Effect.prototype.RebuildCachedData = function(resource)
{
    if (resource.IsGood())
    {
        this.BindParameters();
    }
};

/**
 * BindParameters
 * @returns {boolean}
 * @prototype
 */
Tw2Effect.prototype.BindParameters = function()
{
    if (this.effectRes === null || !this.effectRes.IsGood())
    {
        return false;
    }

    for (var i = 0; i < this.passes.length; ++i)
    {
        for (var j = 0; j < this.passes[i].stages.length; ++j)
        {
            for (var k = 0; k < this.passes[i].stages[j].reroutedParameters.length; ++k)
            {
                this.passes[i].stages[j].reroutedParameters[k].Unbind();
            }
        }
    }
    this.passes = [];
    for (var i = 0; i < this.effectRes.passes.length; ++i)
    {
        var pass = [];
        pass.stages = [];
        for (var j = 0; j < this.effectRes.passes[i].stages.length; ++j)
        {
            var stageRes = this.effectRes.passes[i].stages[j];
            var stage = {};
            stage.constantBuffer = new Float32Array(stageRes.constantSize);
            stage.reroutedParameters = [];
            stage.parameters = [];
            stage.textures = [];
            stage.constantBuffer.set(stageRes.constantValues);

            for (var k = 0; k < stageRes.constants.length; ++k)
            {
                var constant = stageRes.constants[k];
                var name = constant.name;
                if (name === 'PerFrameVS' ||
                    name === 'PerObjectVS' ||
                    name === 'PerFramePS' ||
                    name === 'PerObjectPS' ||
                    name === 'PerObjectPSInt')
                {
                    continue;
                }
                if (name in this.parameters)
                {
                    var param = this.parameters[name];
                    if (param.Bind(stage.constantBuffer, constant.offset, constant.size))
                    {
                        stage.reroutedParameters.push(param);
                    }
                    else
                    {
                        var p = {};
                        p.parameter = param;
                        p.constantBuffer = stage.constantBuffer;
                        p.offset = constant.offset;
                        p.size = constant.size;
                        stage.parameters.push(p);
                    }
                }
                else if (store.HasVariable(name))
                {
                    var param = store.GetVariable(name);
                    var p = {};
                    p.parameter = param;
                    p.constantBuffer = stage.constantBuffer;
                    p.offset = constant.offset;
                    p.size = constant.size;
                    stage.parameters.push(p);
                }
                else if (constant.isAutoregister)
                {
                    var param = store.RegisterVariable(name, undefined, constant.type);
                    if (param)
                    {
                        var p = {};
                        p.parameter = param;
                        p.constantBuffer = stage.constantBuffer;
                        p.offset = constant.offset;
                        p.size = constant.size;
                        stage.parameters.push(p);
                    }
                }
            }

            for (var k = 0; k < stageRes.textures.length; ++k)
            {
                var name = stageRes.textures[k].name;
                var param = null;
                if (name in this.parameters)
                {
                    param = this.parameters[name];
                }
                else if (store.HasVariable(name))
                {
                    param = store.GetVariable(name);
                }
                else if (stageRes.textures[k].isAutoregister)
                {
                    param = store.RegisterVariable(name, undefined, Tw2TextureParameter);
                }
                else
                {
                    continue;
                }
                var p = {};
                p.parameter = param;
                p.slot = stageRes.textures[k].registerIndex;
                p.sampler = null;
                for (var n = 0; n < stageRes.samplers.length; ++n)
                {
                    if (stageRes.samplers[n].registerIndex === p.slot)
                    {
                        if (stageRes.samplers[n].name in this.samplerOverrides)
                        {
                            p.sampler = this.samplerOverrides[stageRes.samplers[n].name].GetSampler(stageRes.samplers[n]);
                        }
                        else
                        {
                            p.sampler = stageRes.samplers[n];
                        }
                        break;
                    }
                }
                if (j === 0)
                {
                    p.slot += 12;
                }
                stage.textures.push(p);
            }
            pass.stages.push(stage);
        }
        this.passes.push(pass);
    }
    if (device.effectObserver)
    {
        device.effectObserver.OnEffectChanged(this);
    }
    return true;
};

/**
 * ApplyPass
 * @param pass
 * @prototype
 */
Tw2Effect.prototype.ApplyPass = function(pass)
{
    if (this.effectRes === null || !this.effectRes.IsGood() || pass >= this.passes.length)
    {
        return;
    }

    this.effectRes.ApplyPass(pass);
    var p = this.passes[pass];
    var rp = this.effectRes.passes[pass];
    var d = device;
    if (d.IsAlphaTestEnabled() && rp.shadowShaderProgram)
    {
        var program = rp.shadowShaderProgram;
    }
    else
    {
        var program = rp.shaderProgram;
    }
    for (var i = 0; i < 2; ++i)
    {
        var stages = p.stages[i];
        for (var j = 0; j < stages.parameters.length; ++j)
        {
            var pp = stages.parameters[j];
            pp.parameter.Apply(pp.constantBuffer, pp.offset, pp.size);
        }
        for (var j = 0; j < stages.textures.length; ++j)
        {
            var tex = stages.textures[j];
            tex.parameter.Apply(tex.slot, tex.sampler, program.volumeSlices[tex.sampler.registerIndex]);
        }
    }
    if (program.constantBufferHandles[0] !== null)
    {
        d.gl.uniform4fv(program.constantBufferHandles[0], p.stages[0].constantBuffer);
    }
    if (program.constantBufferHandles[7] !== null)
    {
        d.gl.uniform4fv(program.constantBufferHandles[7], p.stages[1].constantBuffer);
    }
    if (device.perFrameVSData && program.constantBufferHandles[1])
    {
        d.gl.uniform4fv(program.constantBufferHandles[1], d.perFrameVSData.data);
    }
    if (device.perFramePSData && program.constantBufferHandles[2])
    {
        d.gl.uniform4fv(program.constantBufferHandles[2], d.perFramePSData.data);
    }
    if (d.perObjectData)
    {
        d.perObjectData.SetPerObjectDataToDevice(program.constantBufferHandles);
    }
};

/**
 * GetPassCount
 * @returns {number}
 * @prototype
 */
Tw2Effect.prototype.GetPassCount = function()
{
    if (this.effectRes === null || !this.effectRes.IsGood())
    {
        return 0;
    }
    return this.passes.length;
};

/**
 * GetPassInput
 * @param {number} pass
 * @returns {*}
 * @prototype
 */
Tw2Effect.prototype.GetPassInput = function(pass)
{
    if (this.effectRes === null || !this.effectRes.IsGood() || pass >= this.passes.length)
    {
        return null;
    }
    if (device.IsAlphaTestEnabled() && this.effectRes.passes[pass].shadowShaderProgram)
    {
        return this.effectRes.passes[pass].shadowShaderProgram.input;
    }
    else
    {
        return this.effectRes.passes[pass].shaderProgram.input;
    }
};

/**
 * Render
 * @param {function} cb - callback
 * @prototype
 */
Tw2Effect.prototype.Render = function(cb)
{
    var count = this.GetPassCount();
    for (var i = 0; i < count; ++i)
    {
        this.ApplyPass(i);
        cb(this, i);
    }
};


/**
 * Gets an object containing the textures currently set in the Tw2Effect
 * - Matches sof texture objects
 * @returns {Object.<string, Tw2TextureParameter>}
 * @prototype
 */
Tw2Effect.prototype.GetTextures = function()
{
    var textures = {};

    for (var param in this.parameters)
    {
        if (this.parameters.hasOwnProperty(param) && this.parameters[param] instanceof Tw2TextureParameter)
        {
            textures[param] = this.parameters[param].resourcePath;
        }
    }

    return textures;
};

/**
 * Gets an object containing all non texture parameters currently set in the Tw2Effect
 * - Matches sof parameter object
 * @returns {Object.<string, Tw2FloatParameter|Tw2Vector2Parameter|Tw2Vector3Parameter|Tw2Vector4Parameter|Tw2VariableParameter>}
 * @prototype
 */
Tw2Effect.prototype.GetParameters = function()
{
    var parameters = {};

    for (var param in this.parameters)
    {
        if (this.parameters.hasOwnProperty(param) && !(this.parameters[param] instanceof Tw2TextureParameter))
        {
            if (!(this.parameters[param] instanceof Tw2VariableParameter))
            {
                parameters[param] = this.parameters[param].GetValue();
            }
            else
            {
                parameters[param] = this.parameters[param].variableName;
            }
        }
    }

    return parameters;
};
