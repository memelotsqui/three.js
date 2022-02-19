import * as THREE from '../../../build/three.module.js';
import * as BufferGeometryUtils from '../utils/BufferGeometryUtils.js';
class BatchCombine {
    constructor(gltf, combinedOnStart) {
        if (gltf === undefined)
            return null;
        const scope = this;

        this.originalMeshes = [];
        this.combinedMeshes = [];

        let gltfScene = gltf.scene;

        batchCombine(gltf);


        this.displayBatchGeometry = function(display) {
            for (var i = 0; i < scope.originalMeshes.length; i++) {
                scope.originalMeshes[i].visible = !display;
            }
            for (var i = 0; i < scope.combinedMeshes.length; i++) {
                scope.combinedMeshes[i].visible = display;
            }
        }

        if (!combinedOnStart) {
            scope.displayBatchGeometry(false);
        }

        function batchCombine(gltf) {
            let meshSameMaterial = [];
            let origMats = [];
            // for (var i = 0; i < gltf.materials.length; i++) {
            //     meshSameMaterial[i] = [];
            // }
            gltf.scene.traverse((o) => {
                if (o.isMesh) {
                    if (o.material !== undefined) {
                        if (o.material.length === undefined) {
                            let newMat = true;
                            for (var j = 0; j < origMats.length; j++) {
                                if (o.material === origMats[j]){
                                    newMat = false;
                                    if (CheckIfStatic(o))
                                        meshSameMaterial[j].push(o);
                                }
                            }
                            if (newMat === true){
                                origMats.push(o.material);
                                meshSameMaterial[origMats.length-1] = [];
                                if (CheckIfStatic(o))
                                    meshSameMaterial[origMats.length-1].push(o);
                            }
                            



                            // for (var j = 0; j < gltf.materials.length; j++) {
                            //     if (o.material === gltf.materials[j]) {
                            //        console.log("same material");
                            //         if (o.userData.gameObject !== undefined)
                            //             if (o.userData.gameObject.userData.batching !== undefined)
                            //                 if (o.userData.gameObject.userData.batching === true) {
                            //                     meshSameMaterial[j].push(o);
                            //                 }
                            //     }
                            // }
                        }
                    }
                }
            });

            for (var i = 0; i < meshSameMaterial.length; i++) {
                CombineMeshes(meshSameMaterial[i]);
            }

        }

        function CheckIfStatic(mesh){
            if (mesh.userData.gameObject !== undefined){
                if (mesh.userData.gameObject.userData.batching !== undefined){
                    if (mesh.userData.gameObject.userData.batching === true) {
                        return true;
                    }
                }
            }
            return false;
        }

        function CombineMeshes(meshArray) {

            if (meshArray.length == 0) return null;
            if (meshArray.length == 1) return meshArray[0];

            let hasPos = false;
            let hasNorms = false;
            let hasUV1s = false;
            let hasUV2s = false;
            let hasColors = false;

            for (var i = 0; i < meshArray.length; i++) {

                if (hasPos == false) hasPos = HasAttribute(meshArray[i].geometry, 'position');
                if (hasNorms == false) hasNorms = HasAttribute(meshArray[i].geometry, 'normal');
                if (hasUV1s == false) hasUV1s = HasAttribute(meshArray[i].geometry, 'uv')
                if (hasUV2s == false) hasUV2s = HasAttribute(meshArray[i].geometry, 'uv2')
                if (hasColors == false) hasColors = HasAttribute(meshArray[i].geometry, 'color')
            }

            const geometries = [];

            for (var i = 0; i < meshArray.length; i++) {
                const geom = new THREE.BufferGeometry();

                let inverseIndex = false;
                let scale = new THREE.Vector3();
                meshArray[i].getWorldScale(scale);
                let multScale = scale.x * scale.y * scale.z;
                if (multScale < 0)
                    inverseIndex = true;

                let index = GetInt32Array(meshArray[i].geometry.index, inverseIndex);
                let position;

                if (index != null) geom.setIndex(index);
                if (hasPos) {
                    position = GetFloat32Array(meshArray[i].geometry.getAttribute('position'), 3);
                    if (position !== null) geom.setAttribute('position', position);
                }

                position.applyMatrix4(meshArray[i].matrixWorld);

                let itemCount = position.count;

                if (hasNorms) {
                    let normal = GetFloat32Array(meshArray[i].geometry.getAttribute('normal'), 3, itemCount)
                    if (normal !== null) geom.setAttribute('normal', normal);
                }

                if (hasUV1s) {
                    let uv = GetFloat32Array(meshArray[i].geometry.getAttribute('uv'), 2, itemCount);
                    if (uv !== null) geom.setAttribute('uv', uv);
                }

                if (hasUV2s) {
                    let uv2 = GetFloat32Array(meshArray[i].geometry.getAttribute('uv2'), 2, itemCount);
                    if (uv2 !== null) geom.setAttribute('uv2', uv2);
                }

                if (hasColors) {
                    let color = GetFloat32Array(meshArray[i].geometry.getAttribute('color'), 3, itemCount);
                    if (color !== null) geom.setAttribute('color', color);
                }
                geometries.push(geom);

                scope.originalMeshes.push(meshArray[i]);
                meshArray[i].visible = false;
            }

            const geometry = BufferGeometryUtils.mergeBufferGeometries(geometries, true);
            geometry.computeBoundingSphere();

            const mesh = new THREE.Mesh(geometry, meshArray[0].material);
            gltfScene.add(mesh);

            scope.combinedMeshes.push(mesh);


        }

        function HasAttribute(geom, name) {
            if (geom.getAttribute(name) === undefined)
                return false;

            if (geom.getAttribute(name).count > 0)
                return true;
            return false;
        }

        function GetFloat32Array(array, itemSize, positionCount, offset) {

            if (array === undefined) {
                if (positionCount === undefined)
                    return null;
                else {
                    return CreateEmptyBufferData(positionCount, itemSize);
                }
            }
            if (array.constructor === THREE.InterleavedBufferAttribute) {
                return GetInterleaveBufferData(array.data, array.normalized, itemSize, array.offset, array.data.stride); //missing offset
            } else {
                if (array.constructor == Float32Array && offset === undefined)
                    return array;
                else
                    return GetBufferData(array, array.normalized, itemSize); //console.log(array);
            }
        }

        function GetInt32Array(array, inverse) {
            if (array === undefined)
                return null;

            let arrSize = array.count;
            let finalArr = new Int32Array(arrSize);
            if (!inverse) {
                for (var i = 0; i < arrSize; i++) {
                    finalArr[i] = array.array[i];
                }
            } else {
                for (var i = 0; i < arrSize; i++) {
                    finalArr[i] = array.array[array.count - 1 - i];
                }
            }
            return new THREE.BufferAttribute(finalArr, 1);
        }

        function GetInterleaveBufferData(array, normalized, itemSize, offset, stride) {

            let arrSize = array.count * itemSize;
            let arrFullSize = array.array.length;

            let finalArr = new Float32Array(arrSize);

            let factor = 1;
            if (normalized)
                factor = GetByteDivisionFactor(array.array.constructor);

            let count = 0;
            for (var j = offset; j < arrFullSize; j += stride) {
                for (var i = 0; i < itemSize; i++) {
                    finalArr[count] = array.array[j + i] / factor;
                    count++;
                }
            }
            return new THREE.BufferAttribute(finalArr, itemSize);
            //return finalArr;
        }

        function CreateEmptyBufferData(size, itemSize, fillSpace = 0) {
            let finalArr = new Float32Array(size);
            for (var i = 0; i < size; i++) {
                finalArr[i] = fillSpace;
            }
            return new THREE.BufferAttribute(finalArr, itemSize);
        }

        function GetBufferData(array, normalized, itemSize) {
            let arrSize = array.array.length;
            let finalArr = new Float32Array(arrSize);

            let factor = 1;
            if (normalized)
                factor = GetByteDivisionFactor(array.array.constructor);

            for (var i = 0; i < arrSize; i++) {
                finalArr[i] = array.array[i] / factor;
            }
            return new THREE.BufferAttribute(finalArr, itemSize);
        }

        function GetByteDivisionFactor(byteType) {
            switch (byteType) {
                case Uint8Array:
                    return 255;
                case Int8Array:
                    return 127;
                case Uint16Array:
                    return 65535;
                case Int16Array:
                    return 32768;
                default:
                    return 1;
            }
        }
    }
}

export { BatchCombine }