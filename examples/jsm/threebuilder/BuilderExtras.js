import * as THREE from '../../../build/three.module.js';
import { BatchCombine } from './BatchCombine.js';
import { ConvertMaterials } from './ConvertMaterials.js';
import { Reflector } from '../objects/Reflector.js'
class BuilderExtras {
    constructor(gltf, location, mainScene, renderer, mergeMeshes = true, startMerged = true, quality = 2) { //max quality 5
        const scope = this;

        this.gltf = gltf;
        this.mainCamera = null;
        //this.allNodes = [];
        this.allComponents = [];
        this.navMesh = null;
        this.lightmap_textures = [];
        this.lightmap_white = null;

        //mirrors
        this.mirrors = [];
        this.basicMirrorMaterial = null;
        this.stdMirrorMaterial = null;

        this.batchGeom = null;
        this.batchOnStart = startMerged;

        this.quality = quality;

        let scene = gltf.scene;
        let cameras = gltf.cameras;



        //SETUP CAMERAS
        if (gltf.userData.mainCamera !== undefined)
            this.mainCamera = gltf.cameras[gltf.userData.mainCamera];
        else
            this.mainCamera = new THREE.PerspectiveCamera(90, 100 / 100, 1, 2000);
        cameras.forEach((c) => {
            if (c.userData.layerMask !== undefined) {
                c.layers.mask = c.userData.layerMask;
            } else {
                c.layers.mask = -1;
            }
        });

        // ENVIROMENT
        if (gltf.scene.userData.environment !== null) {
            mainScene.environment = gltf.cubeTextures[gltf.scene.userData.environment];
        }


        // if (gltf.userData.environment !== undefined) {
        //     let pmGen = new THREE.PMREMGenerator(renderer);
        //     pmGen.compileCubemapShader();
        //     let cubeTextureLoader = new THREE.CubeTextureLoader().setPath(location + '/');

        //     let envCube = cubeTextureLoader.load(gltf.userData.environment, function() {
        //         envCube = pmGen.fromCubemap(envCube);
        //         pmGen.dispose();
        //         envCube.needsUpdate = true;
        //         //console.log(envCube);
        //     });
        //     mainScene.environment = envCube;
        //     mainScene.environment.encoding = THREE.sRGBEncoding;
        // }


        // -REFLECTIONS


        //INITIAL SETUP MESHES AND OBJECTS
        scene.traverse((o) => {

            if (!o.isMesh && !o.isGroup) {
                o.userData.components = [];
                o.userData.gameObject = o;
            } else {
                if (o.isMesh) {
                    if (o.material !== undefined) {
                        // save its original material in case user wants to switch quality later, not yet used
                        o.userData.originalMaterial = o.material;
                    }
                    if (o.parent.isGroup) {
                        // multi mesh
                        let tarObj = o.parent.parent;
                        // set "gameObject" as target in mesh
                        o.userData.gameObject = tarObj;
                        // set "mesh" as target in gameObject
                        if (tarObj.userData.mesh === undefined)
                            tarObj.userData.mesh = [];
                        tarObj.userData.mesh.push(o);
                        //set layers to every contained object
                        if (tarObj.userData.layer !== undefined) {
                            tarObj.layers.set(tarObj.userData.layer)
                            o.parent.layers.set(tarObj.userData.layer)
                            o.layers.set(tarObj.userData.layer)
                        }
                    } else {
                        // single mesh
                        // if submeshes is defined
                        if (o.userData.submeshes !== undefined) {
                            setSubmeshGroups(o);
                        }
                        let tarObj = o.parent;
                        o.userData.gameObject = tarObj;
                        tarObj.userData.mesh = o;
                        if (tarObj.userData.layer !== undefined) {
                            tarObj.layers.set(tarObj.userData.layer)
                            o.layers.set(tarObj.userData.layer)
                        }
                    }
                }
            }

        });

        //SECONDARY SETUP

        let basicMirrorMaterial = null;
        let stdMirrorMaterial = null;
        scene.traverse((o) => {
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
            // SET VISIBILITY
            if (o.userData.visible !== undefined) {
                o.visible = o.userData.visible;
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
                    console.log("jelo mirror");
                    reflection.minFilter = THREE.LinearFilter;
                    reflection.magFilter = THREE.LinearFilter;
                    reflection.encoding = THREE.sRGBEncoding;
                    reflection.needsUpdate = true;

                    mirrorMat.envMap = reflection;
                    mirrorMat.needsUpdate = true;

                }

                if (o.userData.mesh !== undefined) {
                    scope.mirrors.push(new Mirror(o, mirrorMat, basicMirrorMaterial, scope.quality));
                } else {
                    console.log("No mesh for mirror found in object: " + o.name + " skipping mirror creation");
                }
            }
        });



        //SAVE LIGHTMAPS
        if (gltf.userData.lightmapTextures !== undefined && gltf.textures !== undefined) {
            let _lightmaps = gltf.userData.lightmapTextures;
            for (var i = 0; i < _lightmaps.length; i++) {
                if (_lightmaps[i].lightmapIndex == -1) {
                    this.lightmap_white = gltf.textures[_lightmaps[i].textureIndex];
                } else {
                    this.lightmap_textures[_lightmaps[i].lightmapIndex] = gltf.textures[_lightmaps[i].textureIndex];
                }
            }
        }

        //CONVERT MATERIALS
        let changeAll = quality == 0 ? true : false;
        if (quality < 2)
            ConvertMaterials.convertMaterialsToType(gltf, THREE.MeshLambertMaterial, changeAll);

        //NAVMESH
        if (gltf.userData.navMesh !== undefined) {
            if (gltf.userData.navMesh !== -1) {
                this.navMesh = gltf.nodes[gltf.userData.navMesh];
                this.navMesh.material = new THREE.MeshBasicMaterial();
            }
        }

        //BATCHING
        if (mergeMeshes)
            this.batchGeom = new BatchCombine(gltf, startMerged);




        // OFFSET MAIN UVS

        // OFFSET SECONDARY UVS

        // COMBINED BUFFER GEOMETRY
        function setSubmeshGroups(tarMesh) {
            let data = tarMesh.userData.submeshes;
            let mats = [];
            console.log("jadasjkndkasjndjkasdnk");
            for (var i = 0; i < data.length; i++) {
                mats[i] = (gltf.materials[data[i].material]);
                tarMesh.geometry.addGroup(data[i].start, data[i].count, i);
            }
            tarMesh.material = mats;
        }


        this.callWindowResize = function() {
            //MIRRORS
            for (let i = 0; i < this.mirrors.length; i++) {
                this.mirrors[i].onWindowResize();
            }
        }
        this.showBatchGeometry = function(active) {
            if (scope.batchGeom != null) {
                scope.batchGeom.displayBatchGeometry(active);
            }
        }
        this.setVRQuality = function(active, quality, staticBatching = true) {
            if (active) {
                const mirrorQuality = quality >= 5 ? 4 : quality;
                for (let i = 0; i < this.mirrors.length; i++) {
                    this.mirrors[i].displayMirrorQuality(mirrorQuality);
                }
                if (scope.batchGeom != null) {
                    scope.batchGeom.displayBatchGeometry(staticBatching);
                }
            } else {
                for (let i = 0; i < this.mirrors.length; i++) {
                    this.mirrors[i].displayMirrorQuality(quality);
                }
                if (scope.batchGeom != null) {
                    scope.batchGeom.displayBatchGeometry(scope.batchOnStart);
                }
            }

        }
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

export { BuilderExtras }