import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import PrayerCalendarIntroPanel from '../PrayerCalendarIntroPanel';

describe('PrayerCalendarIntroPanel', () => {
  it('renders the required intro copy and the Enter Prayer Calendar button', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PrayerCalendarIntroPanel onEnter={() => {}} />);
    });
    const text = renderer!.toJSON();
    const asString = JSON.stringify(text);
    expect(asString).toContain('Prayer Calendar');
    expect(asString).toContain('Enter Prayer Calendar');
    expect(asString).toContain('Luke 18:1');
    renderer!.unmount();
  });

  it('calls onEnter when the button is pressed', () => {
    const onEnter = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PrayerCalendarIntroPanel onEnter={onEnter} />);
    });
    const button = renderer!.root.findByProps({ title: 'Enter Prayer Calendar' });
    act(() => {
      button.props.onPress();
    });
    expect(onEnter).toHaveBeenCalledTimes(1);
    renderer!.unmount();
  });
});
