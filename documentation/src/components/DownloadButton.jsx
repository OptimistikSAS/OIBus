import PropTypes from 'prop-types';

const DownloadButton = ({ children, link, color = '#009ee0' }) => (
  <div
    style={{
      marginBottom: '20px',
      marginTop: '10px',
      textAlign: 'center'
    }}
  >
    <a
      rel="nofollow"
      href={link}
      style={{
        backgroundColor: color,
        borderRadius: '10px',
        color: '#f5f5f5',
        padding: '10px',
        cursor: 'pointer',
        minWidth: '10rem',
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'space-around'
      }}
    >
      {children}
    </a>
  </div>
);

DownloadButton.propTypes = {
  link: PropTypes.string.isRequired,
  color: PropTypes.string,
  children: PropTypes.node.isRequired
};

export default DownloadButton;
