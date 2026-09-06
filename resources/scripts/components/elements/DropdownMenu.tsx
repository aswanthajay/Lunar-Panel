import React, { createRef } from 'react';
import styled from 'styled-components/macro';
import Fade from '@/components/elements/Fade';

interface Props {
    children: React.ReactNode;
    renderToggle: (onClick: (e: React.MouseEvent<any, MouseEvent>) => void) => React.ReactChild;
}

export const DropdownButtonRow = styled.button<{ danger?: boolean }>`
    padding: 8px;
    display: flex;
    align-items: center;
    border-radius: 4px;
    width: 100%;
    font-size: 12px;
    color: #A0A0A0;
    transition: 150ms all ease;
    cursor: pointer;
    background: transparent;
    border: none;
    outline: none;

    &:hover {
        color: ${(props) => (props.danger ? '#EF4444' : '#FFFFFF')};
        background-color: ${(props) => (props.danger ? 'rgba(239, 68, 68, 0.15)' : '#161616')};
    }
`;

interface State {
    visible: boolean;
    openUpwards: boolean;
}

class DropdownMenu extends React.PureComponent<Props, State> {
    container = createRef<HTMLDivElement>();
    menu = createRef<HTMLDivElement>();

    state: State = {
        visible: false,
        openUpwards: false,
    };

    componentDidMount() {
        document.addEventListener('mousedown', this.handleClickOutside);
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('contextmenu', this.handleContextMenu);
    }

    componentWillUnmount() {
        document.removeEventListener('mousedown', this.handleClickOutside);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('contextmenu', this.handleContextMenu);
    }

    handleClickOutside = (e: MouseEvent) => {
        if (!this.state.visible) return;
        if (this.container.current && !this.container.current.contains(e.target as Node)) {
            this.setState({ visible: false });
        }
    };

    handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.state.visible) {
            this.setState({ visible: false });
        }
    };

    handleContextMenu = (e: MouseEvent) => {
        if (this.state.visible && this.container.current && !this.container.current.contains(e.target as Node)) {
            this.setState({ visible: false });
        }
    };

    onClickHandler = (e: React.MouseEvent<any, MouseEvent>) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerMenu();
    };

    triggerMenu = (_posX?: number) => {
        let openUpwards = false;
        if (this.container.current) {
            const rect = this.container.current.getBoundingClientRect();
            if (rect.bottom + 260 > window.innerHeight && rect.top > 260) {
                openUpwards = true;
            }
        }
        this.setState((s) => ({
            visible: !s.visible,
            openUpwards,
        }));
    };

    render() {
        const { visible, openUpwards } = this.state;

        return (
            <div ref={this.container} className="relative inline-block text-left">
                {this.props.renderToggle(this.onClickHandler)}
                <Fade timeout={150} in={visible} unmountOnExit>
                    <div
                        ref={this.menu}
                        onClick={(e) => {
                            e.stopPropagation();
                            this.setState({ visible: false });
                        }}
                        style={{ width: '12rem' }}
                        className={`absolute right-0 ${
                            openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                        } bg-[#0D0D0D] p-1.5 rounded-md border border-[#222222] shadow-2xl text-[#C0C0C0] z-[100]`}
                    >
                        {this.props.children}
                    </div>
                </Fade>
            </div>
        );
    }
}

export default DropdownMenu;
