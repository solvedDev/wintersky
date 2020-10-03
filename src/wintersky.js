const Config = require("./config")

(function() {

const MathUtil = {
	roundTo(num, digits) {
		var d = Math.pow(10,digits)
		return Math.round(num * d) / d
	},
	randomab(a, b) {
		return a + Math.random() * (b-a)
	},
	radToDeg(rad) {
		return rad / Math.PI * 180
	},
	degToRad(deg) {
		return Math.PI / (180 /deg)
	},
	clamp(number, min, max) {
		if (number > max) number = max;
		if (number < min || isNaN(number)) number = min;
		return number;
	}
}
const Normals = {
	x: new THREE.Vector3(1, 0, 0),
	y: new THREE.Vector3(0, 1, 0),
	z: new THREE.Vector3(0, 0, 1),
	n: new THREE.Vector3(0, 0, 0),
}

/*
const Wintersky = {
	renderLoop: setInverval(function() {
		if (Emitter && document.hasFocus() && !Wintersky.paused) {
			Emitter.tick()
		}
	}, 1000/30),
	paused: false,
	emitters: [],
	renderUpdate() {
		this.emitters.forEach(emitter => {
			emitter.tickParticleRotation();
		})
	}
};
*/


class Wintersky {
	constructor(config) {
		this.object = new THREE.Object3D();
		this.material = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			transparent: true,
			alphaTest: 0.2
		});
		Wintersky.emitters.push(this);

		this.config = config instanceof Config ? config : new Config(config);


		this.particles = [];
		this.dead_particles = [];
		this.age = 0;
		this.enabled = false;
		this.mode = 'looping';
		this.random_vars = [Math.random(), Math.random(), Math.random(), Math.random()]
		this.tick_variables = {};
		this.tick_values = {};
		this.creation_variables = {};
		this.creation_values = {};
	}
	params() {
		var obj = {
			"variable.entity_scale": 1
		};
		obj["variable.emitter_lifetime"] = this.lifetime;
		obj["variable.emitter_age"] = this.age;
		obj["variable.emitter_random_1"] = this.random_vars[0];
		obj["variable.emitter_random_2"] = this.random_vars[1];
		obj["variable.emitter_random_3"] = this.random_vars[2];
		obj["variable.emitter_random_4"] = this.random_vars[3];
		return obj;
	}
	updateMaterial() {
		var url;
		var path = Data.particle.texture.inputs.path.value;
		if (Data.particle.texture.inputs.image.image) {
			url = Data.particle.texture.inputs.image.image.data;
		} else {
			if (path == 'textures/particle/particles') {
				url = 'assets/default_particles.png';
	
			} else if (path == 'textures/flame_atlas' || path == 'textures/particle/flame_atlas') {
				url = 'assets/flame_atlas.png';
	
			} else if (path == 'textures/particle/campfire_smoke') {
				url = 'assets/campfire_smoke.png';
			} else {
				url = 'assets/missing.png';
			}
		}
		var tex = new THREE.TextureLoader().load(url, function(a, b) {
			function factorize(input, axis, factor) {
				if (!input.value || !input.value[axis]) return;
				var arr = input.value.slice()
				var val = arr[axis]
				if (isNaN(val)) {
					arr[axis] = `${factor} * (${val})`
				} else {
					arr[axis] = factor * parseFloat(val);
				}
				input.value = arr;
			}
	
			tex.magFilter = THREE.NearestFilter
			tex.minFilter = THREE.NearestFilter
			System.material.map = tex
			var x_factor = System.material.map.image.naturalWidth / this.Flipbook.width;
			var y_factor = System.material.map.image.naturalHeight / this.Flipbook.height;
			if (x_factor && x_factor != 1) {
				factorize(Data.particle.texture.inputs.uv, 0, x_factor)
				factorize(Data.particle.texture.inputs.uv_size, 0, x_factor)
				factorize(Data.particle.texture.inputs.uv_step, 0, x_factor)
			}
			if (y_factor && y_factor != 1) {
				factorize(Data.particle.texture.inputs.uv, 1, y_factor)
				factorize(Data.particle.texture.inputs.uv_size, 1, y_factor)
				factorize(Data.particle.texture.inputs.uv_step, 1, y_factor)
			}
			this.Flipbook.width = System.material.map.image.naturalWidth;
			this.Flipbook.height = System.material.map.image.naturalHeight;
			if (typeof cb === 'function') {
				cb()
			}
		})
	}
	start() {

		for (var i = this.particles.length-1; i >= 0; i--) {
			this.particles[i].remove()
		}
		this.age = 0;
		this.enabled = true;
		var params = this.params()
		this.active_time = Data.emitter.lifetime.active_time.calculate(params)
		this.sleep_time = Data.emitter.lifetime.sleep_time.calculate(params)
		this.random_vars = [Math.random(), Math.random(), Math.random(), Math.random()]
		this.creation_values = {};
		for (var key in this.creation_variables) {
			var s = this.creation_variables[key];
			this.creation_values[key] = Molang.parse(s)
		}
		if (getValue(1, 'rate', 'mode') === 'instant') {
			this.spawnParticles(Data.emitter.rate.amount.calculate(params))
		}
		return this;
	}
	tick() {
		var params = this.params()
		this.tick_values = {};
		for (var key in this.tick_variables) {
			var s = this.tick_variables[key];
			Emitter.tick_values[key] = Molang.parse(s, params)
		}
		if (this.enabled && getValue(1, 'rate', 'mode') === 'steady') {
			var p_this_tick = Data.emitter.rate.rate.calculate(params)/30
			var x = 1/p_this_tick;
			var c_f = Math.round(this.age*30)
			if (c_f % Math.round(x) == 0) {
				p_this_tick = Math.ceil(p_this_tick)
			} else {
				p_this_tick = Math.floor(p_this_tick)
			}
			this.spawnParticles(p_this_tick)
		}
		this.particles.forEach(p => {
			p.tick()
		})

		this.age += 1/30;
		var age = MathUtil.roundTo(this.age, 5);
		if (this.mode == 'looping') {
			//Looping
			if (this.enabled && age >= this.active_time) {
				this.stop()
			}
			if (!this.enabled && age >= this.sleep_time) {
				this.start()
			}
		} else if (this.mode == 'once') {
			//Once
			if (this.enabled && age >= this.active_time) {
				this.stop()
			}
		} else if (this.mode === 'expression') {
			//Expressions
			if (this.enabled && Data.emitter.lifetime.expiration.calculate(params)) {
				this.stop()
			}
			if (!this.enabled && Data.emitter.lifetime.activation.calculate(params)) {
				this.start()
			}
		}
		return this;
	}
	jumpTo(second) {
		let old_time = Math.round(second*30)
		let new_time = Math.round(this.age*30)
		if (old_time < new_time) {
			while (old_time < new_time) {
				this.tick();
				old_time++;
			}
		} else if (old_time > new_time) {

		}
	}
	tickParticleRotation() {
		this.particles.forEach(p => {

			switch (Data.particle.appearance.facing_camera_mode.value) {
				case 'lookat_xyz':
					p.mesh.lookAt(View.camera.position)
					break;
				case 'lookat_y':
					var v = new THREE.Vector3().copy(View.camera.position);
					v.y = p.position.y;
					p.mesh.lookAt(v);
					break;
				case 'rotate_xyz':
					p.mesh.rotation.copy(View.camera.rotation);
					break;
				case 'rotate_y':
					p.mesh.rotation.copy(View.camera.rotation);
					p.mesh.rotation.reorder('YXZ');
					p.mesh.rotation.x = p.mesh.rotation.z = 0;
					break;
				case 'direction':
					var q = new THREE.Quaternion().setFromUnitVectors(Normals.z, p.speed)
					p.mesh.rotation.setFromQuaternion(q);
					break;
			}
			p.mesh.rotation.z += p.rotation||0;
		})
	}
	stop() {
		this.enabled = false;
		this.age = 0;
		return this;
	}
	spawnParticles(count) {
		if (!count) return this;

		if (Data.emitter.rate.mode.value == 'steady') {
			var max = Data.emitter.rate.maximum.calculate(this.params())||0;
			max = MathUtil.clamp(max, 0, Wintersky.global_config.max_emitter_particles)
			count = MathUtil.clamp(count, 0, max-this.particles.length);
		} else {
			count = MathUtil.clamp(count, 0, Wintersky.global_config.max_emitter_particles-this.particles.length);
		}
		for (var i = 0; i < count; i++) {
			if (this.dead_particles.length) {
				var p = this.dead_particles.pop()
			} else {
				var p = new Particle()
			}
			p.add()
		}
		return count;
	}
}
Wintersky.emitters = [];
Wintersky.global_config = {
	max_emitter_particles: 10000
}

Wintersky.Particle = class {
	constructor(data) {
		if (!data) data = 0;

		this.geometry = new THREE.PlaneGeometry(1, 1)
		this.material = System.material.clone();
		this.mesh = new THREE.Mesh(this.geometry, this.material)
		this.position = this.mesh.position;

		this.speed = data.speed||new THREE.Vector3();
		this.acceleration = data.acceleration||new THREE.Vector3();

		this.add()
	}
	params() {
		var obj = Emitter.params();
		obj["variable.particle_lifetime"] = this.lifetime;
		obj["variable.particle_age"] = this.age;
		obj["variable.particle_random_1"] = this.random_vars[0];
		obj["variable.particle_random_2"] = this.random_vars[1];
		obj["variable.particle_random_3"] = this.random_vars[2];
		obj["variable.particle_random_4"] = this.random_vars[3];
		return obj;
	}
	add() {
		if (!Emitter.particles.includes(this)) {
			Emitter.particles.push(this);
			System.group.add(this.mesh)
		}

		this.age = this.loop_time = 0;
		this.current_frame = 0;
		this.random_vars = [Math.random(), Math.random(), Math.random(), Math.random()]
		this.material.copy(System.material)
		this.material.needsUpdate = true;
		var params = this.params()

		this.position.set(0, 0, 0)
		this.lifetime = Data.particle.lifetime.max_lifetime.calculate(params);
		this.initial_rotation = Data.particle.rotation.initial_rotation.calculate(params);
		this.rotation_rate = Data.particle.rotation.rotation_rate.calculate(params);
		this.rotation = 0;

		//Init Position:
		var surface = Data.emitter.shape.surface_only.value;
		if (Emitter.shape === 'box') {
			var size = Data.emitter.shape.half_dimensions.calculate(params);

			this.position.x = MathUtil.randomab(-size.x, size.x);
			this.position.y = MathUtil.randomab(-size.y, size.y);
			this.position.z = MathUtil.randomab(-size.z, size.z);

			if (surface) {
				var face = Math.floor(MathUtil.randomab(0, 3))
				var side = Math.floor(MathUtil.randomab(0, 2))
				this.position.setComponent(face, size.getComponent(face) * (side?1:-1))
			}
		} else if (Emitter.shape === 'entity_aabb') {
			var size = new THREE.Vector3(0.5, 1, 0.5);

			this.position.x = MathUtil.randomab(-size.x, size.x);
			this.position.y = MathUtil.randomab(-size.y, size.y);
			this.position.z = MathUtil.randomab(-size.z, size.z);

			if (surface) {
				var face = Math.floor(MathUtil.randomab(0, 3))
				var side = Math.floor(MathUtil.randomab(0, 2))
				this.position.setComponent(face, size.getComponent(face) * (side?1:-1))
			}
		} else if (Emitter.shape === 'sphere') {

			var radius = Data.emitter.shape.radius.calculate(params)
			if (surface) {
				this.position.x = radius
			} else {
				this.position.x = radius * Math.random()
			}
			this.position.applyEuler(THREE.getRandomEuler())
		} else if (Emitter.shape === 'disc') {
			var radius = Data.emitter.shape.radius.calculate(params)
			var ang = Math.random()*Math.PI*2
			var dis = surface ? radius : radius * Math.sqrt(Math.random())

			this.position.x = dis * Math.cos(ang)
			this.position.z = dis * Math.sin(ang)

			var normal = Data.emitter.shape.plane_normal.calculate(params)
			if (!normal.equals(Normals.n)) {
				var q = new THREE.Quaternion().setFromUnitVectors(Normals.y, normal)
				this.position.applyQuaternion(q)
			}
		}
		//Speed
			//this.speed = Data.particle.motion.direction_speed.calculate(params);
		this.speed = new THREE.Vector3()
		var dir = Data.particle.direction.mode.value;
		if (dir == 'inwards' || dir == 'outwards') {

			if (Emitter.shape === 'point') {
				this.speed.set(1, 0, 0).applyEuler(THREE.getRandomEuler())
			} else {
				this.speed.copy(this.position).normalize()
				if (dir == 'inwards') {
					this.speed.negate()
				}
			}
		} else {
			this.speed = Data.particle.direction.direction.calculate(params).normalize()
		}
		var speed = Data.particle.motion.linear_speed.calculate(params);
		this.speed.x *= speed;
		this.speed.y *= speed;
		this.speed.z *= speed;

		this.position.add(Data.emitter.shape.offset.calculate(params))

		//UV
		this.setFrame(0)

		return this.tick();
	}
	tick() {
		var params = this.params()

		//Lifetime
		this.age += 1/30;
		this.loop_time += 1/30;
		if (Data.particle.lifetime.mode.value === 'time') {
			if (this.age > this.lifetime) {
				this.remove();
			}
		} else {
			if (Data.particle.lifetime.expiration_expression.calculate(params)) {
				this.remove();
			}
		}
		//Movement
		if (Data.particle.motion.mode.value === 'dynamic') {
			//Position
			var drag = Data.particle.motion.linear_drag_coefficient.calculate(params);
			this.acceleration = Data.particle.motion.linear_acceleration.calculate(params);
			this.acceleration.addScaledVector(this.speed, -drag)
			this.speed.addScaledVector(this.acceleration, 1/30);
			this.position.addScaledVector(this.speed, 1/30);

			//Rotation
			var rot_drag = Data.particle.rotation.rotation_drag_coefficient.calculate(params)
			var rot_acceleration = Data.particle.rotation.rotation_acceleration.calculate(params)
				rot_acceleration += -rot_drag * this.rotation_rate;
			this.rotation_rate += rot_acceleration*1/30;
			this.rotation = MathUtil.degToRad(this.initial_rotation + this.rotation_rate*this.age);
		} else {
			if (Data.particle.motion.relative_position.value.join('').length) {
				this.position.copy(Data.particle.motion.relative_position.calculate(params));
			}
			this.rotation = MathUtil.degToRad(Data.particle.rotation.rotation.calculate(params));
		}

		//Size
		var size = Data.particle.appearance.size.calculate(params);
		this.mesh.scale.x = size.x*2.25 || 0.0001;
		this.mesh.scale.y = size.y*2.25 || 0.0001;

		//UV
		if (Data.particle.texture.mode.value === 'animated') {
			var max_frame = Data.particle.texture.max_frame.calculate(params);
			if (Data.particle.texture.stretch_to_lifetime.value && max_frame) {
				var fps = max_frame/this.lifetime;
			} else {
				var fps = Data.particle.texture.frames_per_second.calculate(params);
			}
			if (Math.floor(this.loop_time*fps) > this.current_frame) {
				this.current_frame = Math.floor(this.loop_time*fps);
				if (max_frame && this.current_frame > max_frame) {
					if (Data.particle.texture.loop.value) {
						this.current_frame = 0;
						this.loop_time = 0;
						this.setFrame(this.current_frame);
					}
				} else {
					this.setFrame(this.current_frame);
				}
			}
		}

		//Color (ToDo)
		if (Data.particle.color.mode.value === 'expression') {
			var c = Data.particle.color.expression.calculate(params)
			this.material.color.r = c.x;
			this.material.color.g = c.y;
			this.material.color.b = c.z;
		}

		return this;
	}
	remove() {
		Emitter.particles.remove(this)
		System.group.remove(this.mesh)
		Emitter.dead_particles.push(this)
		return this;
	}
	setFrame(n) {
		var params = this.params()
		var uv = Data.particle.texture.uv.calculate(params)
		var size = Data.particle.texture.uv_size.calculate(params)
		if (n) {
			var offset = Data.particle.texture.uv_step.calculate(params)
			uv.addScaledVector(offset, n)
		}
		this.setUV(uv.x, uv.y, size.x||Flipbook.width, size.y||Flipbook.height)
	}
	setUV(x, y, w, h) {
		var epsilon = 0.05
		var vertex_uvs = this.geometry.faceVertexUvs[0]

		w = (x+w - 2*epsilon) / Flipbook.width;
		h = (y+h - 2*epsilon) / Flipbook.height;
		x = (x + (w>0 ? epsilon : -epsilon)) / Flipbook.width;
		y = (y + (h>0 ? epsilon : -epsilon)) / Flipbook.height;

		vertex_uvs[0][0].set(x, 1-y)
		vertex_uvs[0][1].set(x, 1-h)
		vertex_uvs[0][2].set(w, 1-y)
		vertex_uvs[1][1].set(w, 1-h)

		vertex_uvs[1][0] = vertex_uvs[0][1];
		vertex_uvs[1][2] = vertex_uvs[0][2];
		this.geometry.uvsNeedUpdate = true
	}
}
Wintersky.Config = Config;

module.exports = Wintersky

})()
