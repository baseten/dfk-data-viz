import classNames from 'classnames';

import styles from './App.module.css';

import Graph from './Graph';
import { whaleWatchData } from './data';

function App() {
  return (
    <div className={styles.app}>
      <Graph data={whaleWatchData.data} />

      <div className={styles.key}>
        <span className={styles.keyPart}>
          <span className={classNames(styles.keyBox, styles.bank)} />
          Circulating xJewel (in Jewel)
        </span>
        <span className={styles.keyPart}>
          <span className={classNames(styles.keyBox, styles.circulating)} />
          Circulating Jewel
        </span>
      </div>
    </div>
  );
}

export default App;
