/**
 * Tw2ParticleAttributeGenerator base class
 *
 * @property {string} name
 * @class
 */
export class Tw2ParticleAttributeGenerator
{
    constructor()
    {
        this.name = '';
    }

    /**
     * Binds a particle system element to the generator
     * @param {Tw2ParticleSystem} ps
     * @returns {boolean} True if successfully bound
     */
    Bind(ps)
    {
        return false;
    }

    /**
     * Generates the attributes
     * @param {Tw2ParticleElement} position
     * @param {Tw2ParticleElement} velocity
     * @param {number} index
     */
    Generate(position, velocity, index)
    {

    }
}