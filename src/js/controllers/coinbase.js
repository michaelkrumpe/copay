'use strict';

angular.module('copayApp.controllers').controller('coinbaseController', function($scope, $timeout, $ionicModal, $ionicHistory, $log, coinbaseService, lodash, platformInfo, ongoingProcess, popupService, externalLinkService) {

  var isNW = platformInfo.isNW;
  var isCordova = platformInfo.isCordova;

  var init = function() {
    $scope.currency = coinbaseService.getAvailableCurrency();
    coinbaseService.getStoredToken(function(at) {
      $scope.accessToken = at;
      
      // Update Access Token if necessary
      $scope.loading = true;
      coinbaseService.init(function(err, data) {
        $scope.loading = false;
        if (err || lodash.isEmpty(data)) {
          if (err) {
            $log.error(err);
            var errorId = err.errors ? err.errors[0].id : null;
            err = err.errors ? err.errors[0].message : err;
            popupService.showAlert('Error connecting to Coinbase', err, function() {
              if (errorId == 'revoked_token') {
                coinbaseService.logout(function() {});
              }
              $ionicHistory.goBack();
            });
          }
          return;
        }

        // Show rates
        coinbaseService.buyPrice(data.accessToken, $scope.currency, function(err, b) {
          $scope.buyPrice = b.data || null;
        });
        coinbaseService.sellPrice(data.accessToken, $scope.currency, function(err, s) {
          $scope.sellPrice = s.data || null;
        });

        // Updating accessToken and accountId
        $timeout(function() {
          $scope.accessToken = data.accessToken;
          $scope.accountId = data.accountId;
          $scope.updateTransactions();
          $scope.$apply();
        }, 100);
      });
    });
  };

  $scope.updateTransactions = function() {
    $log.debug('Getting transactions...');
    $scope.pendingTransactions = { data: {} };
    coinbaseService.getPendingTransactions($scope.pendingTransactions);
  };

  this.openAuthenticateWindow = function() {
    var oauthUrl = this.getAuthenticateUrl();
    if (!isNW) {
      externalLinkService.open(oauthUrl);
    } else {
      var self = this;
      var gui = require('nw.gui');
      gui.Window.open(oauthUrl, {
        focus: true,
        position: 'center'
      }, function(new_win) {
        new_win.on('loaded', function() {
          var title = new_win.window.document.title;
          $timeout(function() {
            if (title.indexOf('Coinbase') == -1) {
              $scope.code = title;
              self.submitOauthCode($scope.code);
              new_win.close();
            }
          }, 100);
        });
      });
    }
  }

  this.getAuthenticateUrl = function() {
    $scope.showOauthForm = isCordova || isNW ? false : true;
    return coinbaseService.getOauthCodeUrl();
  };

  this.submitOauthCode = function(code) {
    var self = this;
    ongoingProcess.set('connectingCoinbase', true);
    coinbaseService.getToken(code, function(err, accessToken) {
      ongoingProcess.set('connectingCoinbase', false);
      if (err) {
        popupService.showAlert('Error connecting to Coinbase', err);
        return;
      }
      $scope.accessToken = accessToken;
      init();
    });
  };

  this.openTxModal = function(tx) {
    $scope.tx = tx;

    $ionicModal.fromTemplateUrl('views/modals/coinbase-tx-details.html', {
      scope: $scope,
      animation: 'slide-in-up'
    }).then(function(modal) {
      $scope.modal = modal;
      $scope.modal.show();
    });
  };

  var self = this;
  $scope.$on("$ionicView.beforeEnter", function(event, data) {
    if (data.stateParams && data.stateParams.code) {
      coinbaseService.getStoredToken(function(at) {
        if (!at) self.submitOauthCode(data.stateParams.code);
      });
    } else {
      init();
    }
  });
});
