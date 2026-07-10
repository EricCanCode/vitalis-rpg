// IntroScene — Phaser port of the legacy Vitalis intro cutscene
// (archive/legacy-rpg-starter/intro.js). Beat content lives in
// INTRO_SCENES in data.js; this scene only plays it back.
// Assumes BootScene has already loaded the 'ruins' texture.
import { INTRO_SCENES } from './data.js';
import { markTitleSeen } from './state.js';

const TEXT_FADE_MS = 1400;
const TITLE_FADE_MS = 2200;
const PULSE_MAX_ALPHA = 0.3;

export class IntroScene extends Phaser.Scene {
  constructor() {
    super('IntroScene');
  }

  create() {
    const data = this.scene.settings.data || {};
    this.beats = data.beats || INTRO_SCENES;
    this.nextScene = data.next || 'TownScene';
    this.isPrologue = !data.beats;
    this.cameras.main.setBackgroundColor('#000000');
    this.finished = false;
    this.beatIndex = -1;
    this.beatTimer = 0;
    this.beatObjects = [];
    this.fadeTargets = [];
    this.pulseOverlay = null;

    this.addSkipHint();
    this.advanceBeat();

    this.input.keyboard.on('keydown', this.finish, this);
    this.input.on('pointerdown', this.finish, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.finish, this);
      this.input.off('pointerdown', this.finish, this);
    });

    this.cameras.main.fadeIn(450, 0, 0, 0);
  }

  update(time, delta) {
    if (this.finished) return;
    const beat = this.beats[this.beatIndex];
    if (!beat) return;
    this.beatTimer += delta;
    this.applyBeatEffects(beat);
    if (this.beatTimer >= beat.duration) this.advanceBeat();
  }

  advanceBeat() {
    this.clearBeat(true);
    this.beatIndex += 1;
    this.beatTimer = 0;
    const beat = this.beats[this.beatIndex];
    if (!beat) {
      this.finish();
      return;
    }
    if (beat.type === 'fadeText') this.buildFadeText(beat);
    else if (beat.type === 'imageSlide') this.buildImageSlide(beat);
    else if (beat.type === 'lightPulse') this.buildLightPulse(beat);
    else if (beat.type === 'title') this.buildTitle(beat);
  }

  clearBeat(soft = false) {
    const outgoing = this.beatObjects;
    this.beatObjects = [];
    this.fadeTargets = [];
    this.pulseOverlay = null;
    if (soft && outgoing.length) {
      this.tweens.add({
        targets: outgoing,
        alpha: 0,
        duration: 320,
        ease: 'Sine.easeIn',
        onComplete: () => outgoing.forEach(object => object.destroy())
      });
      return;
    }
    outgoing.forEach(object => object.destroy());
  }

  applyBeatEffects(beat) {
    const fadeDuration = beat.type === 'title' ? TITLE_FADE_MS : TEXT_FADE_MS;
    const fadeAlpha = Math.min(1, this.beatTimer / fadeDuration);
    this.fadeTargets.forEach(target => target.setAlpha(fadeAlpha * (target.introMaxAlpha ?? 1)));
    if (this.pulseOverlay) {
      const pulse = Math.sin(this.beatTimer * 0.005) * 0.5 + 0.5;
      this.pulseOverlay.setAlpha(pulse * PULSE_MAX_ALPHA);
    }
  }

  buildFadeText(beat) {
    beat.text.forEach((line, index) => {
      const text = this.add.text(this.scale.width / 2, this.scale.height / 2 + index * 34, line, {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5).setAlpha(0);
      this.beatObjects.push(text);
      this.fadeTargets.push(text);
    });
  }

  buildImageSlide(beat) {
    if (beat.imageKey && this.textures.exists(beat.imageKey)) {
      const image = this.add.image(this.scale.width / 2, this.scale.height / 2, beat.imageKey).setAlpha(0);
      const scale = Math.max(this.scale.width / image.width, this.scale.height / image.height);
      image.setScale(scale);
      this.beatObjects.push(image);
      this.fadeTargets.push(image);
    }
    beat.text.forEach((line, index) => {
      const text = this.add.text(this.scale.width / 2, this.scale.height - 120 + index * 30, line, {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }).setOrigin(0.5).setAlpha(0).setDepth(5);
      text.introMaxAlpha = 0.85;
      this.beatObjects.push(text);
      this.fadeTargets.push(text);
    });
  }

  buildLightPulse(beat) {
    this.pulseOverlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 1)
      .setOrigin(0)
      .setAlpha(0);
    this.beatObjects.push(this.pulseOverlay);
    beat.text.forEach((line, index) => {
      const text = this.add.text(this.scale.width / 2, this.scale.height / 2 + index * 34, line, {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5).setDepth(5);
      this.beatObjects.push(text);
    });
  }

  buildTitle(beat) {
    const title = this.add.text(this.scale.width / 2, this.scale.height / 2, beat.text[0], {
      fontFamily: 'Georgia, serif',
      fontSize: '72px',
      fontStyle: 'bold',
      color: '#f4c95d',
      align: 'center'
    }).setOrigin(0.5).setAlpha(0);
    title.setShadow(0, 0, '#ff8c00', 30, true, true);
    this.beatObjects.push(title);
    this.fadeTargets.push(title);
    if (beat.text[1]) {
      const subtitle = this.add.text(this.scale.width / 2, this.scale.height / 2 + 64, beat.text[1], {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#d8cfb7',
        align: 'center'
      }).setOrigin(0.5).setAlpha(0);
      this.beatObjects.push(subtitle);
      this.fadeTargets.push(subtitle);
    }
  }

  addSkipHint() {
    this.add.text(this.scale.width / 2, this.scale.height - 30, 'Press any key to skip', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#aaaaaa'
    }).setOrigin(0.5).setAlpha(0.4).setDepth(10);
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    if (this.isPrologue) markTitleSeen();
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(this.nextScene);
    });
    this.cameras.main.fadeOut(400, 0, 0, 0);
  }
}
