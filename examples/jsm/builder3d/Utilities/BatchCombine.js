import { MeshUtilities } from './MeshUtilities.js';

class BatchCombine {
    constructor(gltf, combinedOnStart) {
        if (gltf === undefined)
            return null;

        const scope = this;
        this.data = MeshUtilities.CombineChilds(gltf.scene, true);

        if (!combinedOnStart) {
            scope.displayBatchGeometry(false);
        }

    }
    displayBatchGeometry(display) {
        for (var i = 0; i < this.data.originalMeshes.length; i++) {
            this.data.originalMeshes[i].visible = !display;
        }
        for (var i = 0; i < this.data.combinedMeshes.length; i++) {
            this.data.combinedMeshes[i].visible = display;
        }
    }
    dispose() {
        for (let i = 0; i < this.data.originalMeshes.length; i++) {
            this.data.originalMeshes[i].geometry.dispose();
        }
        for (let i = 0; i < this.data.combinedMeshes.length; i++) {
            this.data.combinedMeshes[i].geometry.dispose();
        }
    }




}

export { BatchCombine }