import * as THREE from 'three';
class AmbientMeshBasicMaterial extends THREE.MeshBasicMaterial {
    static fromMeshStandardMaterial(source) {
        const material = new HubsMeshBasicMaterial();

        THREE.Material.prototype.copy.call(material, source);

        material.color.copy(source.color);

        material.emissive.copy(source.emissive);
        material.emissiveIntensity = source.emissiveIntensity;
        material.emissiveMap = source.emissiveMap;

        material.map = source.map;

        material.lightMap = source.lightMap;
        material.lightMapIntensity = source.lightMapIntensity;

        material.aoMap = source.aoMap;
        material.aoMapIntensity = source.aoMapIntensity;

        material.alphaMap = source.alphaMap;

        material.wireframe = source.wireframe;
        material.wireframeLinewidth = source.wireframeLinewidth;
        material.wireframeLinecap = source.wireframeLinecap;
        material.wireframeLinejoin = source.wireframeLinejoin;

        return material;
    }

    constructor({ emissive, emissiveMap, emissiveIntensity, ambientColor, ...rest } = {}) {
        super(rest);
        this._emissive = { value: emissive || new THREE.Color() };
        this._emissiveIntensity = { value: emissiveIntensity === undefined ? 1 : emissiveIntensity };
        this._emissiveMap = { value: emissiveMap };
        this._ambientColor = { value: ambientColor || new THREE.Color(0.5, 0.5, 0.5) }
    }

    get emissive() {
        return this._emissive.value;
    }

    set emissive(emissive) {
        this._emissive.value = emissive;
    }

    get emissiveIntensity() {
        return this._emissiveIntensity.value;
    }

    set emissiveIntensity(emissiveIntensity) {
        this._emissiveIntensity.value = emissiveIntensity;
    }

    get emissiveMap() {
        return this._emissiveMap.value;
    }

    set emissiveMap(emissiveMap) {
        this._emissiveMap.value = emissiveMap;
    }

    copy(source) {
        super.copy(source);
        this.emissive.copy(source.emissive);
        this.emissiveIntensity = source.emissiveIntensity;
        this.emissiveMap = source.emissiveMap;
        return this;
    }


    onBeforeCompile = shader => {
        // This patch to the MeshBasicMaterial adds support for emissive maps.
        shader.uniforms.emissive = this._emissive;
        shader.uniforms.emissiveIntensity = this._emissiveIntensity;
        shader.uniforms.emissiveMap = this._emissiveMap;
        shader.uniforms.ambientColor = this._ambientColor;
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <lightmap_pars_fragment>",
            `#include <lightmap_pars_fragment>
            uniform vec3 emissive;
            uniform sampler2D emissiveMap;
            uniform vec3 ambientColor;
      `
        );
        // shader.fragmentShader = shader.fragmentShader.replace(
        //     "ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );",
        //     "ReflectedLight reflectedLight = ambientColor;")
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <aomap_fragment>",
            `#include <aomap_fragment>
            
            reflectedLight.indirectDiffuse += ambientColor;
            `)
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <envmap_fragment>",
            `#include <envmap_fragment>

        vec3 totalEmissiveRadiance = emissive;
        #include <emissivemap_fragment>
        outgoingLight += totalEmissiveRadiance;


        //outgoingLight += envColor.xyz;
      `
        );
    };
}

export { AmbientMeshBasicMaterial }