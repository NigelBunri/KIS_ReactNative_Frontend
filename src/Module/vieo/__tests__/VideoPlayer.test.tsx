import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import VideoPlayer from '../VideoPlayer';

describe('VideoPlayer', () => {
  const activeRenderers: ReactTestRenderer.ReactTestRenderer[] = [];
  afterEach(() => {
    // Unmounts every renderer created this test — without this, dev-only
    // timers (the onReadyForDisplay diagnostic) and listeners stay alive
    // past the test and Jest warns about open handles.
    while (activeRenderers.length) {
      activeRenderers.pop()!.unmount();
    }
  });

  it('passes the resolved source to the underlying player', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <VideoPlayer sourceUrl="https://cdn.example.com/a.mp4" autoPlay />,
      );
    });
    activeRenderers.push(renderer!);

    const video = renderer!.root.findByProps({ testID: 'mock-video' });
    expect(video.props.source.uri).toBe('https://cdn.example.com/a.mp4');
  });

  it('is paused when externalPause is true, regardless of autoPlay', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <VideoPlayer sourceUrl="https://cdn.example.com/a.mp4" autoPlay externalPause />,
      );
    });
    activeRenderers.push(renderer!);

    const video = renderer!.root.findByProps({ testID: 'mock-video' });
    expect(video.props.paused).toBe(true);
  });

  it('resumes automatically after externalPause clears, only if it was actually playing before', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    const Wrapper = ({ externalPause }: { externalPause: boolean }) => (
      <VideoPlayer sourceUrl="https://cdn.example.com/a.mp4" autoPlay externalPause={externalPause} />
    );

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Wrapper externalPause={false} />);
    });
    activeRenderers.push(renderer!);
    let video = renderer!.root.findByProps({ testID: 'mock-video' });
    expect(video.props.paused).toBe(false); // autoPlay -> playing

    await ReactTestRenderer.act(async () => {
      renderer.update(<Wrapper externalPause />);
    });
    video = renderer!.root.findByProps({ testID: 'mock-video' });
    expect(video.props.paused).toBe(true);

    await ReactTestRenderer.act(async () => {
      renderer.update(<Wrapper externalPause={false} />);
    });
    video = renderer!.root.findByProps({ testID: 'mock-video' });
    expect(video.props.paused).toBe(false); // resumed, since it WAS playing
  });

  it('does not resume on externalPause clearing if the user had already paused manually', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    const Wrapper = ({ externalPause }: { externalPause: boolean }) => (
      <VideoPlayer sourceUrl="https://cdn.example.com/a.mp4" autoPlay={false} externalPause={externalPause} />
    );

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Wrapper externalPause={false} />);
    });
    activeRenderers.push(renderer!);
    let video = renderer!.root.findByProps({ testID: 'mock-video' });
    expect(video.props.paused).toBe(true); // never playing (autoPlay false)

    await ReactTestRenderer.act(async () => {
      renderer.update(<Wrapper externalPause />);
    });
    await ReactTestRenderer.act(async () => {
      renderer.update(<Wrapper externalPause={false} />);
    });
    video = renderer!.root.findByProps({ testID: 'mock-video' });
    expect(video.props.paused).toBe(true); // still not playing
  });

  it('hides the poster only after onReadyForDisplay fires (not merely onLoad)', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <VideoPlayer sourceUrl="https://cdn.example.com/a.mp4" poster="https://cdn.example.com/poster.jpg" />,
      );
    });
    activeRenderers.push(renderer!);

    const findPoster = () =>
      renderer!.root.findAll((node) => (node.type as unknown) === 'Image' && node.props.resizeMode === 'cover', {
        deep: true,
      });

    expect(findPoster().length).toBe(1);

    const video = renderer!.root.findByProps({ testID: 'mock-video' });
    await ReactTestRenderer.act(async () => {
      video.props.onLoad?.({ duration: 10, naturalSize: {} });
    });
    // onLoad alone must not hide the poster — this is exactly the audio-
    // plays-picture-black bug class the ready-for-display gate exists for.
    expect(findPoster().length).toBe(1);

    await ReactTestRenderer.act(async () => {
      video.props.onReadyForDisplay?.();
    });
    expect(findPoster().length).toBe(0);
  });
});
