import * as THREE from '../../../../build/three.module.js';
import { Reflector } from '../../objects/Reflector.js';
import { BatchCombine } from '../../builder3dUtilities/BatchCombine.js';
import { MeshUtilities } from '../../builder3dUtilities/MeshUtilities.js';
import { ConvertMaterials } from '../../builder3dUtilities/ConvertMaterials.js';
import ThreeMeshUI from '../../three-mesh-ui/three-mesh-ui.js'

class ExtrasLoader {
    constructor(builder, rules) {
        this.rules = rules;
        this.scene = builder.scene;
        this.quality = builder.quality;
        this.whiteLightmap = new THREE.TextureLoader().load('https://ipfs.io/ipfs/QmPRgv5baksBTYM3UM3Wt5BaYVnx7yaJJMEweJT6TokihW');

        this.renderer = builder.renderer;
    }
    loadData(smart, customData) { //max quality 5
        const scope = this;
        const gltf = smart.gltf;
        const nodes = gltf.nodes;
        if (gltf.asset.generator == "ola k ase") {

            customData = customData === undefined ? {} : customData;

            if (gltf.userData.smartObject !== undefined) {

                if (gltf.userData.smartObject.smartType !== undefined) {
                    if (gltf.userData.smartObject.smartType === "space") {
                        customData.affectSceneEnvironment = customData.affectSceneEnvironment === undefined ? true : customData.affectSceneEnvironment;
                        customData.addMeshBackground = customData.addMeshBackground === undefined ? true : customData.addMeshBackground;
                        console.log(customData.addMeshBackground);
                    }
                    if (gltf.userData.smartObject.smartType === "object") {}
                    if (gltf.userData.smartObject.smartType === "character") {}
                }
            }

            const affectSceneEnvironment = customData.affectSceneEnvironment === undefined ? false : customData.affectSceneEnvironment;
            const addMeshBackground = customData.addMeshBackground === undefined ? false : customData.addMeshBackground;

            console.log(addMeshBackground);
            const mergeMeshes = false;
            //const mergeMeshes = customData.mergeMeshes === undefined ? true : customData.mergeMeshes;
            const startMerged = customData.startMerged === undefined ? true : customData.startMerged;

            let extras = {};
            extras.navMesh = null;
            extras.lightmap_textures = [];
            extras.lightmap_white = null;
            extras.mirrors = [];
            extras.textContainers = [];
            extras.batchGeom = null;
            extras.batchOnStart = startMerged;
            extras.environmentMap = null;
            //this.vrRaycastInteract = [];
            const model = gltf.scene;

            let pmGen = new THREE.PMREMGenerator(this.renderer);
            pmGen.compileCubemapShader();

            //SETUP CAMERAS
            gltf.cameras.forEach((c) => {
                if (c.userData.layerMask !== undefined) {
                    c.layers.mask = c.userData.layerMask;
                } else {
                    c.layers.mask = -1;
                }
            });

            // SCENE
            // -REFLECTIONS
            if (model.userData.environment !== undefined) {
                let envMap = gltf.cubeTextures[model.userData.environment];
                if (envMap !== undefined) {
                    extras.environmentMap = envMap;
                    extras.environmentMap.needsUpdate = true;
                    extras.environmentMap.encoding = THREE.sRGBEncoding;
                }
            }
            if (affectSceneEnvironment && extras.environmentMap !== null) {
                scope.scene.environment = extras.environmentMap;
            }

            // -BACKGROUND
            if (model.userData.background !== undefined) {
                console.log("up to here");
                if (model.userData.background.cubeTexture !== undefined) {
                    console.log("enters");
                    console.log(addMeshBackground);
                    console.log(model.userData.background);
                    let backgroundMap = gltf.cubeTextures[model.userData.background.cubeTexture.index];
                    // -ON SCENE
                    if (affectSceneEnvironment) {
                        scope.scene.background = backgroundMap;
                        scope.scene.background.needsUpdate = true;
                        scope.scene.background.encoding = THREE.sRGBEncoding;
                    }
                    // if (addMeshBackground && model.userData.background.cubeTexture.node !== undefined) {
                    //     const scale = model.userData.background.cubeTexture.scale === undefined ? 1 : model.userData.background.cubeTexture.scale;
                    //     scope.rules.setSkybox(backgroundMap, scale);
                    // }
                    if (addMeshBackground) {
                        const scale = model.userData.background.cubeTexture.scale === undefined ? 1 : model.userData.background.cubeTexture.scale;
                        scope.rules.setSkybox(backgroundMap, scale);
                    }
                    
                }
            }

            // -FOG
            if (model.userData.fog !== undefined && affectSceneEnvironment) {
                const fogData = model.userData.fog;
                //missing fog exp2
                scope.scene.fog = new THREE.Fog(new THREE.Color(fogData.color[0], fogData.color[1], fogData.color[2]),
                    fogData.near, fogData.far)
            }

            //NAVMESH
            if (gltf.userData.navMesh !== undefined) {
                if (gltf.userData.navMesh !== -1) {
                    extras.navMesh = gltf.nodes[gltf.userData.navMesh];
                    extras.navMesh.material = new THREE.MeshBasicMaterial();
                }
            }
            //SETUP MATERIAL ENVIRONMENT
            gltf.materials.forEach((m) => {
                if (m.constructor.name == "MeshStandardMaterial") {
                    if (m.envMap === null)
                        m.envMap = extras.environmentMap;
                }
            });

            // ASSIGN MESH AND GROUP CONNECTIONS CONNECTIONS TO NODES

            // INTIAL NODES SETUP
            model.traverse((o) => {

                if (!o.isMesh && !o.isGroup) {
                    o.userData.gameObject = o;
                } else {
                    if (o.isMesh) {
                        if (o.material !== undefined) {
                            // STORE ORIGINAL MATERIAL IN CASE OF CHANGED
                            o.userData.originalMaterial = o.material;
                        }
                        if (o.parent.isGroup) {
                            // MULTI MESH - GLTF IMPORTER CREATES GROUPED MESHES, SO THE ORIGINAL OBJECT IS 2 PARENTS ABOVE
                            let tarObj = o.parent.parent;
                            console.log(o.parent);
                            // set "gameObject" as target in mesh
                            o.userData.gameObject = tarObj;
                            // set "mesh" as target in gameObject
                            if (tarObj.userData.mesh === undefined)
                                tarObj.userData.mesh = [];
                            tarObj.userData.mesh.push(o);
                            //set layers to every contained object
                            if (tarObj.userData.layer !== undefined) {
                                if (tarObj.userData.layer === 2) { // In Unity, layer 2 is "ignore raycast", so we remove this object from raycast detection layer
                                    tarObj.layers.disable(30);
                                    o.parent.layers.disable(30);
                                    o.layers.disable(30);
                                } else {
                                    tarObj.layers.set(tarObj.userData.layer)
                                    o.parent.layers.set(tarObj.userData.layer)
                                    o.layers.set(tarObj.userData.layer)
                                }

                            }
                        } else {
                            // SINGLE MESH - IN CUSTOM EXPORTER, EVERY MESH IS STORED AS A LEAF NODE, IN CASE QUANTIZATION IS USED
                            let tarObj = o.parent;
                            o.userData.gameObject = tarObj;
                            tarObj.userData.mesh = o;
                            if (tarObj.userData.layer !== undefined) {
                                tarObj.layers.set(tarObj.userData.layer)
                                o.layers.set(tarObj.userData.layer)
                            }

                            // SINGLE MESH WITH SUBMESHES
                            if (o.userData.submeshes !== undefined) {
                                setSubmeshGroups(o);
                            }
                        }
                    }
                }

            });

            //SECONDARY SETUP
            let basicMirrorMaterial = null;
            let stdMirrorMaterial = null;
            model.traverse((o) => {
                //SET IMPORTANT MATERIALS
                if (o.userData.keepMat) {
                    let changeChilds = true;
                    if (o.userData.keepMat.changeChilds !== undefined) {
                        changeChilds = o.userData.keepMat.changeChilds;
                    }
                    if (changeChilds === true) {
                        o.traverse((c) => {
                            c.userData.keepMat = {};
                        });
                    } else {
                        if (o.userData.mesh.length !== undefined) {
                            for (let i = 0; i < o.userData.mesh.length; i++) {
                                o.userData.mesh[i].userData.keepMat = {};
                            }
                        } else {
                            o.userData.mesh.userData.keepMat = {};
                        }
                    }
                }

                // TELEPORT SPOTS FOR VR
                if (o.userData.teleport !== undefined) {
                    // no longer require to add anything
                }
                // CREATE MIRRORS
                if (o.userData.mirror !== undefined) {
                    if (basicMirrorMaterial == null) {
                        //MIRROR MATERIALS
                        basicMirrorMaterial = new THREE.MeshBasicMaterial({
                            color: 0x3d3d3d
                        });
                        stdMirrorMaterial = new THREE.MeshStandardMaterial({
                            metalness: 1.0,
                            roughness: 0.0,
                            color: 0xffffff,
                            envMap: scope.environmentMap
                        });
                    }

                    let mirrorMat = stdMirrorMaterial;
                    if (o.userData.mirror.envMap !== undefined) {
                        mirrorMat = stdMirrorMaterial.clone();
                        let reflection = gltf.cubeTextures[o.userData.mirror.envMap];
                        reflection.minFilter = THREE.LinearFilter;
                        reflection.magFilter = THREE.LinearFilter;
                        reflection.encoding = THREE.sRGBEncoding;

                        mirrorMat.envMap = reflection;
                        mirrorMat.needsUpdate = true;

                    }

                    if (o.userData.mesh !== undefined) {
                        extras.mirrors.push(new Mirror(o, mirrorMat, basicMirrorMaterial, scope.quality));
                    } else {
                        console.log("No mesh for mirror found in object: " + o.name + " skipping mirror creation");
                    }
                }
                
                if (o.userData.textContainer !== undefined) {
                    extras.textContainers.push(new TextContainer(o, this.rules))
                }

                // COMBINE MESHES
                if (o.userData.mergeChilds !== undefined) {
                    MeshUtilities.CombineChilds(o, false);
                }
            });

            //SAVE LIGHTMAPS
            if (gltf.userData.lightmapTextures !== undefined && gltf.textures !== undefined) {
                let _lightmaps = gltf.userData.lightmapTextures;
                for (var i = 0; i < _lightmaps.length; i++) {
                    if (_lightmaps[i].lightmapIndex == -1) {
                        extras.lightmap_white = gltf.textures[_lightmaps[i].textureIndex];
                    } else {
                        extras.lightmap_textures[_lightmaps[i].lightmapIndex] = gltf.textures[_lightmaps[i].textureIndex];
                    }
                }
            }

            //CONVERT MATERIALS
            let changeAll = scope.quality == 0 ? true : false;
            if (scope.quality < 2)
                ConvertMaterials.convertMaterialsToType(gltf, THREE.MeshLambertMaterial, changeAll);



            //BATCHING
            if (mergeMeshes) {
                extras.batchGeom = new BatchCombine(gltf, startMerged);
            }

            //CLOSE
            pmGen.dispose();


            // OFFSET MAIN UVS

            // OFFSET SECONDARY UVS

            // COMBINED BUFFER GEOMETRY
            function setSubmeshGroups(tarMesh) {
                let data = tarMesh.userData.submeshes;
                let mats = [];

                for (var i = 0; i < data.length; i++) {
                    mats[i] = (gltf.materials[data[i].material]);
                    tarMesh.geometry.addGroup(data[i].start, data[i].count, i);
                }
                tarMesh.material = mats;
            }

            extras.dispose = function() {
                this.navMesh = null;
                for (let i = 0; i < this.lightmap_textures; i++) {
                    this.lightmap_textures[i].dispose();
                }
                if (this.lightmap_white !== null)
                    this.lightmap_white.dispose();

                if (this.batchGeom !== null)
                    this.batchGeom.dispose();
                if (this.environmentMap !== null)
                    this.environmentMap.dispose();

                for (let i = 0; i < this.mirrors.length; i++) {
                    this.mirrors[i].dispose();
                    this.mirrors[i] = null;
                }
                this.mirrors = null;
            }

            return extras;
        } else {
            gltf.materials.forEach(m => {

                console.log(m);
                m.lightMap = this.whiteLightmap;
            });
            return null;
        }


    }
    callWindowResize(extras) {
        //MIRRORS
        for (let i = 0; i < extras.mirrors.length; i++) {
            extras.mirrors[i].onWindowResize();
        }
    }
    showBatchGeometry(extras, active) {
        if (extras.batchGeom != null) {
            extras.batchGeom.displayBatchGeometry(active);
        }
    }
    setVRQuality(extras, active, quality, staticBatching = true) {
        if (active) {
            const mirrorQuality = quality >= 5 ? 4 : quality;
            for (let i = 0; i < extras.mirrors.length; i++) {
                extras.mirrors[i].displayMirrorQuality(mirrorQuality);
            }
            if (scope.batchGeom != null) {
                extras.batchGeom.displayBatchGeometry(staticBatching);
            }
        } else {
            for (let i = 0; i < extras.mirrors.length; i++) {
                extras.mirrors[i].displayMirrorQuality(quality);
            }
            if (scope.batchGeom != null) {
                extras.batchGeom.displayBatchGeometry(extras.batchOnStart);
            }
        }
    }

}

class TextContainer {
    constructor(object, rules) {

        const data = object.userData.textContainer;
        const container = new ThreeMeshUI.Block({
            width: data.width,
            height: data.height,
            padding: data.padding,
            justifyContent: data.justifyContent,
            alignContent: data.alignContent,
            fontFamily: rules.mainFontFamilyLocation,
            fontTexture: rules.mainFontTextureLocation,
        });

        container.add(
            container.text = new ThreeMeshUI.Text({
                content: data.textContent,
                //content: "hewlo",
                fontSize: data.fontSize
            })
        );

        container.layers.mask = object.layers.mask;
        container.userData.gameObject = object;
        object.userData.textContent = container.text;

        object.add(container);
        container.updateLayout();
    }
}

class Mirror {
    constructor(object, stdMaterial, basicMaterial, initQuality = 1) {
        const scope = this;

        this.object = object;
        this.reflector = null;
        this.baseMesh = object.userData.mesh;

        this.stdMaterial = stdMaterial;
        this.basicMaterial = basicMaterial;

        // preadd material to avoid mesh batching
        setMaterial(stdMaterial);

        //create reflector with existing geometry
        let geometry = object.userData.mesh.geometry;

        this.reflector = new Reflector(geometry, {
            clipBias: 0.0003,
            textureWidth: window.innerWidth * window.devicePixelRatio,
            textureHeight: window.innerHeight * window.devicePixelRatio,
            color: 0x777777
        });

        this.baseMesh.userData.canMerge = false;
        this.reflector.userData.canMerge = false;
        object.add(this.reflector);

        function setMaterial(mat) {
            if (scope.baseMesh.material.length === undefined)
                scope.baseMesh.material = mat;
            else {
                for (let i = 0; i < scope.baseMesh.material.length; i++) {
                    scope.baseMesh.material[i] = mat;
                }
            }
        }


        this.displayMirrorQuality = function(quality) {
            if (quality == 0) {
                setMaterial(basicMaterial);
                scope.baseMesh.visible = true;
                scope.reflector.visible = false;
            }
            if (quality > 0 && quality < 5) {
                setMaterial(stdMaterial);
                scope.baseMesh.visible = true;
                scope.reflector.visible = false;
            }
            if (quality >= 5) {
                scope.baseMesh.visible = false;
                scope.reflector.visible = true;
            }
        }
        this.onWindowResize = function() {
            scope.reflector.getRenderTarget().setSize(
                window.innerWidth * window.devicePixelRatio,
                window.innerHeight * window.devicePixelRatio
            );
        }

        this.displayMirrorQuality(initQuality);
    }
    dispose() {
        this.stdMaterial.envMap.dispose();
        this.stdMaterial.dispose();

        this.basicMaterial.dispose();
    }
}

export { ExtrasLoader }